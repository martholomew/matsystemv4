const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');
const psList = require('ps-list');
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

const execAsync = promisify(exec);

const userDataPath = app.getPath('userData');
const configDir = path.join(userDataPath, 'config');
const binDir = path.join(userDataPath, 'bin');
const configPath = path.join(configDir, 'config.json');
const versionPath = path.join(binDir, 'version.json');

const BLACKLISTED_PROCESSES = [
  'LunaHostCLI32.exe',
  'LunaHostCLI64.exe',
  'services.exe',
  'svchost.exe',
  'winedevice.exe',
  'plugplay.exe',
  'rpcss.exe',
  'explorer.exe',
  'tabtip.exe'
];

const state = {
  currentText: '',
  currentExeName: ''
};

async function getExeProcesses() {
  const processes = await psList.default();
  return processes
    .filter(p => p.cmd.toLowerCase().includes('.exe'))
    .filter(p => !BLACKLISTED_PROCESSES.includes(p.name.toLowerCase()));
}

async function getProcessDetails(proc) {
  try {
    const pid = proc.pid;
    let _64bit = false;
    let envVars = null;

    if (process.platform === 'linux') {
      const { stdout: archOutput } = await execAsync(`file -L /proc/${pid}/exe`);
      _64bit = archOutput.includes('64-bit');

      try {
        const { stdout: envOutput } = await execAsync(`cat /proc/${pid}/environ`);
        const allEnvVars = envOutput.split('\0').reduce((acc, pair) => {
          const [key, value] = pair.split('=');
          if (key) acc[key] = value || '';
          return acc;
        }, {});
        envVars = {};
        ['WINEPREFIX', 'WINEFSYNC', 'WINELOADER'].forEach(key => {
          if (allEnvVars[key]) envVars[key] = allEnvVars[key];
        });
      } catch (e) {
        envVars = null;
      }
    }

    return { pid, name: proc.name, _64bit, envVars };
  } catch (error) {
    return null;
  }
}

async function findPidByExeName({ exeName, winePath, wineprefix, winefsync }) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      WINEPREFIX: path.resolve(wineprefix),
      WINEFSYNC: winefsync
    };

    const cmd = `${winePath} cmd /c "tasklist /FI \\"IMAGENAME eq ${exeName}\\" /FO CSV /NH"`;
    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Error executing Wine command: ${stderr || error.message}`));
        return;
      }

      const lines = stdout.trim().split('\n');
      const resultLine = lines.find(line => line.includes(exeName)) || '';

      if (!resultLine) {
        resolve(null);
        return;
      }

      const columns = resultLine.split('","');
      if (columns.length < 2) {
        resolve(null);
        return;
      }

      const pid = parseInt(columns[1].replace(/"/g, ''));
      resolve(isNaN(pid) ? null : pid);
    });
  });
}

class LunaHostCLI {
  constructor({ winePath, wineprefix, winefsync, processId, is64bit, onOutput }) {
    const executableName = is64bit ? 'LunaHostCLI64.exe' : 'LunaHostCLI32.exe';
    const executablePath = path.join(binDir, executableName);

    const customEnv = {
      WINEDEBUG: 'fixme-all',
      WINEFSYNC: winefsync,
      WINEPREFIX: path.resolve(wineprefix),
    };
    const env = { ...process.env, ...customEnv };

    this.process = require('child_process').spawn(winePath, [executablePath], { env });
    this.process.stdout.setEncoding('utf16le');
    this.process.stderr.setEncoding('utf8');

    this.lastThreadId = '0';
    this.lastProcessId = 0;
    this.lastHookcode = '';
    this.onOutput = onOutput;

    this.process.stdout.on('data', (data) => this.handleOutput(data));
    this.process.stderr.on('data', (data) => this.onOutput({ type: 'log', error: data }));
    this.process.on('close', (code) => this.onOutput({ type: 'log', exit: code }));

    this.attach(processId);
  }

  sendCommand(command) {
    const buffer = Buffer.from(command + '\n', 'utf16le');
    this.process.stdin.write(buffer);
  }

  attach(processId) {
    this.sendCommand(`attach -P${processId}`);
  }

  handleOutput(data) {
    const lines = data.split('\n');
    let accumulatedOutput = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '' || trimmedLine.startsWith('Usage:')) continue;

      const match = trimmedLine.match(/\[([^\]]+)\] (.*)/);
      if (match) {
        if (accumulatedOutput) {
          this.sendCategorizedOutput(accumulatedOutput);
          accumulatedOutput = '';
        }

        const fields = match[1].split(':');
        const output = match[2];

        if (fields.length >= 7) {
          const threadId = fields[0];
          const processIdHex = fields[1];
          const processId = parseInt(processIdHex, 16);
          const hookcode = fields.slice(6).join(':');

          this.lastThreadId = threadId;
          this.lastProcessId = processId;
          this.lastHookcode = hookcode;
          accumulatedOutput = output;
        }
      } else if (accumulatedOutput) {
        accumulatedOutput += ' ' + trimmedLine;
      }
    }

    if (accumulatedOutput) {
      this.sendCategorizedOutput(accumulatedOutput);
    }
  }

  sendCategorizedOutput(output) {
    const threadId = this.lastThreadId;
    if (threadId === '0') {
      this.onOutput({ type: 'log', threadId, processId: this.lastProcessId, hookcode: this.lastHookcode, output });
    } else {
      this.onOutput({ type: 'thread', threadId, processId: this.lastProcessId, hookcode: this.lastHookcode, output });
    }
  }
}

async function ensureLatestFiles() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  try {
    const response = await axios.get('https://api.github.com/repos/martholomew/lunahookbuilds/releases/latest');
    const latestData = response.data;
    const latestPublishedAt = latestData.published_at;

    let localVersion = {};
    if (fs.existsSync(versionPath)) {
      localVersion = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    }
    const localPublishedAt = localVersion.published_at || '';

    if (latestPublishedAt !== localPublishedAt) {
      const filesToDownload = [
        'LunaHostCLI32.exe',
        'LunaHostCLI64.exe',
        'LunaHook32.dll',
        'LunaHook64.dll'
      ];

      for (const file of filesToDownload) {
        const asset = latestData.assets.find(a => a.name === file);
        if (asset) {
          const downloadUrl = asset.browser_download_url;
          const filePath = path.join(binDir, file);
          try {
            const fileResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
            fs.writeFileSync(filePath, fileResponse.data);
            console.log(`Downloaded ${file} to ${filePath}`);
          } catch (error) {
            console.error(`Failed to download ${file}:`, error.message);
          }
        } else {
          console.error(`File ${file} not found in the latest release`);
        }
      }

      localVersion.published_at = latestPublishedAt;
      fs.writeFileSync(versionPath, JSON.stringify(localVersion, null, 2));
      console.log(`Updated version.json with published_at: ${latestPublishedAt}`);
    } else {
      console.log('Files are up-to-date');
    }
  } catch (error) {
    console.error('Failed to fetch latest release data:', error.message);
  }
}

export async function setupHooker() {
  await ensureLatestFiles();

  let currentLunaHostCLI = null;

  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.log('No existing config found, starting with empty config');
  }

  ipcMain.handle('get-process-list', async () => {
    const processes = await getExeProcesses();
    return processes.map(p => ({ name: p.cmd.match(/[^\\\/]*\.exe/i), pid: p.pid }));
  });

  ipcMain.on('select-process', async (event, { pid, name }) => {
    console.log(`Selected process: ${name} (PID: ${pid})`);

    const configData = config[name];
    if (configData) {
      event.sender.send('configurationLoaded', configData);
    }

    if (currentLunaHostCLI) {
      currentLunaHostCLI.process.kill();
    }

    const processes = await getExeProcesses();
    const selectedProcess = processes.find(p => p.pid === pid);
    if (!selectedProcess) {
      event.sender.send('error', 'Selected process not found');
      return;
    }

    const details = await getProcessDetails(selectedProcess);
    if (!details) {
      event.sender.send('error', 'Failed to get process details');
      return;
    }
    event.sender.send('process-details', details);

    const winePath = (details.envVars?.WINELOADER) || 'wine';
    const wineprefix = (details.envVars?.WINEPREFIX) || '~/.wine';
    const winefsync = (details.envVars?.WINEFSYNC) || '1';

    const pidFromWine = await findPidByExeName({
      exeName: name,
      winePath,
      wineprefix,
      winefsync
    });

    if (!pidFromWine) {
      event.sender.send('error', 'No matching process found in Wine');
      return;
    }

    currentLunaHostCLI = new LunaHostCLI({
      winePath,
      wineprefix,
      winefsync,
      processId: pidFromWine,
      is64bit: details._64bit,
      onOutput: (output) => {
        if (output.type === 'log') {
          event.sender.send('lunahost-log', output);
        } else if (output.type === 'thread') {
          event.sender.send('lunahost-thread', output);
        }
      }
    });
  });

  ipcMain.on('send-text-to-second', (event, data) => {
    state.currentText = data.text || '';
    state.currentExeName = data.exeName || '';
  
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win.webContents !== event.sender && !win.isDestroyed()) {
        win.webContents.send('update-text', data);
      }
    });
  });

  ipcMain.on('saveConfiguration', (event, exeName, configData) => {
    config[exeName] = {
        ...config[exeName],
        ...configData
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Saved configuration for ${exeName} to ${configPath}`);
});

  ipcMain.handle('get-configuration', (event, exeName) => {
    return config[exeName] || null;
  });
}

export { state };