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
  'tabtip.exe',
  'process_list.exe',
  'steam.exe'
];

const state = {
  currentText: '',
  currentExeName: ''
};

let isSetupComplete = false;

async function getProcessDetails(proc) {
  try {
    const pid = proc.pid;
    let envVars = null;

    if (process.platform === 'linux') {
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

    return { pid, name: proc.name, envVars };
  } catch (error) {
    return null;
  }
}

async function getWinePrefixes(sender) {
  const wineserverProcesses = await psList.default().then(processes => processes.filter(p => p.name === 'wineserver'));
  const prefixes = [];
  for (const proc of wineserverProcesses) {
    const details = await getProcessDetails(proc);
    if (details && details.envVars && details.envVars.WINEPREFIX) {
      const wineprefix = details.envVars.WINEPREFIX;
      sender.send('log', { type: 'info', message: `Found wineprefix: ${wineprefix}` });
      prefixes.push({
        wineprefix: wineprefix,
        winePath: details.envVars.WINELOADER || 'wine',
        winefsync: details.envVars.WINEFSYNC || '0'
      });
    }
  }
  return prefixes;
}

async function getWineProcessesForPrefix({ winePath, wineprefix, winefsync }) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      WINEPREFIX: path.resolve(wineprefix),
      WINEFSYNC: winefsync
    };
    const processListPath = path.join(binDir, 'process_list.exe');
    const cmd = `LANG=ja_JP.utf8 LC_ALL=ja_JP.utf8 "${winePath}" "${processListPath}"`;

    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Error executing Wine command: ${stderr || error.message}`));
        return;
      }
      const lines = stdout.trim().split('\n');
      const dataLines = lines.filter(line => {
        const firstField = line.split(',')[0].replace(/"/g, '');
        return /^\d+$/.test(firstField);
      });
      const processes = dataLines.map(line => {
        const columns = line.split('","');
        if (columns.length >= 3) {
          const pid = parseInt(columns[0].replace(/"/g, ''));
          const name = columns[1].replace(/"/g, '');
          const bitness = parseInt(columns[2].replace(/"/g, ''));
          return { pid, name, bitness };
        }
        return null;
      }).filter(p => p && !BLACKLISTED_PROCESSES.includes(p.name.toLowerCase()));
      resolve(processes);
    });
  });
}

async function getAllWineProcesses(sender) {
  const prefixes = await getWinePrefixes(sender);
  const allProcesses = [];
  for (const prefix of prefixes) {
    try {
      const processes = await getWineProcessesForPrefix(prefix);
      const processesWithPrefix = processes.map(proc => ({
        ...proc,
        wineprefix: prefix.wineprefix,
        winePath: prefix.winePath,
        winefsync: prefix.winefsync
      }));
      allProcesses.push(...processesWithPrefix);
    } catch (error) {
      sender.send('log', { type: 'error', message: `Failed to get processes for prefix ${prefix.wineprefix}: ${error.message}` });
    }
  }
  return allProcesses;
}

class LunaHostCLI {
  constructor({ winePath, wineprefix, winefsync, processId, is64bit, onOutput }) {
    const executableName = is64bit ? 'LunaHostCLI64.exe' : 'LunaHostCLI32.exe';
    const executablePath = path.join(binDir, executableName);

    const customEnv = {
      WINEDEBUG: '-all',
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

async function ensureLatestFiles(sender) {
  sender.send('log', { type: 'info', message: 'Checking for updates...' });
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  let localVersions = {};
  if (fs.existsSync(versionPath)) {
    localVersions = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
  }

  const repos = {
    lunahookbuilds: {
      url: 'https://api.github.com/repos/martholomew/lunahookbuilds/releases/latest',
      files: ['LunaHostCLI32.exe', 'LunaHostCLI64.exe', 'LunaHook32.dll', 'LunaHook64.dll']
    },
    process_list: {
      url: 'https://api.github.com/repos/martholomew/process_list/releases/latest',
      files: ['process_list.exe']
    }
  };

  for (const [repoName, repoData] of Object.entries(repos)) {
    try {
      sender.send('log', { type: 'info', message: `Checking updates for ${repoName}...` });
      const response = await axios.get(repoData.url);
      const latestData = response.data;
      const latestPublishedAt = latestData.published_at;

      const localPublishedAt = localVersions[repoName] || '';

      if (latestPublishedAt !== localPublishedAt) {
        for (const file of repoData.files) {
          const asset = latestData.assets.find(a => a.name === file);
          if (asset) {
            sender.send('log', { type: 'info', message: `Downloading ${file} from ${repoName}...` });
            const downloadUrl = asset.browser_download_url;
            const filePath = path.join(binDir, file);
            try {
              const fileResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
              fs.writeFileSync(filePath, fileResponse.data);
              sender.send('log', { type: 'info', message: `Downloaded ${file} to ${filePath}` });
            } catch (error) {
              sender.send('log', { type: 'error', message: `Failed to download ${file}: ${error.message}` });
            }
          } else {
            sender.send('log', { type: 'error', message: `File ${file} not found in the latest release of ${repoName}` });
          }
        }
        localVersions[repoName] = latestPublishedAt;
      } else {
        sender.send('log', { type: 'info', message: `Files for ${repoName} are up-to-date` });
      }
    } catch (error) {
      sender.send('log', { type: 'error', message: `Failed to fetch latest release data for ${repoName}: ${error.message}` });
    }
  }

  fs.writeFileSync(versionPath, JSON.stringify(localVersions, null, 2));
  sender.send('log', { type: 'info', message: 'Update check complete.' });
}

async function attachToProcess(event, processData, config, currentLunaHostCLI) {
  const { name, pid, bitness, wineprefix, winePath, winefsync } = processData;
  console.log(`Attaching to process: ${name} (PID: ${pid}, WINEPREFIX: ${wineprefix})`);

  const configData = config[name];
  if (configData) {
    event.sender.send('configurationLoaded', configData);
  }

  if (currentLunaHostCLI) {
    currentLunaHostCLI.process.kill();
  }

  const is64bit = bitness === 64;

  currentLunaHostCLI = new LunaHostCLI({
    winePath,
    wineprefix,
    winefsync,
    processId: pid,
    is64bit,
    onOutput: (output) => {
      if (output.type === 'log') {
        if (output.error) {
          event.sender.send('log', { type: 'error', message: output.error });
        } else if (output.exit !== undefined) {
          event.sender.send('log', { type: 'info', message: `Process exited with code ${output.exit}` });
        } else {
          event.sender.send('log', { type: 'info', message: output.output });
        }
      } else if (output.type === 'thread') {
        event.sender.send('lunahost-thread', output);
      }
    }
  });
  event.sender.send('process-selected', processData);
  event.sender.send('process-details', processData);
}

export async function setupHooker() {
  const sender = BrowserWindow.getAllWindows()[0].webContents;
  await ensureLatestFiles(sender);
  isSetupComplete = true;
  sender.send('setup-complete');

  let currentLunaHostCLI = null;
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.log('No existing config found, starting with empty config');
  }

  ipcMain.handle('get-process-list', async (event) => {
    if (!isSetupComplete) {
      return { error: 'Setup not complete' };
    }
    const processes = await getAllWineProcesses(event.sender);
    const processList = processes.map(p => ({
      name: p.name,
      pid: p.pid,
      bitness: p.bitness,
      wineprefix: p.wineprefix,
      winePath: p.winePath,
      winefsync: p.winefsync
    }));
  
    for (const proc of processList) {
      if (config[proc.name]) {
        event.sender.send('log', { type: 'info', message: `Auto-selected process: ${proc.name} (PID: ${proc.pid})` });
        attachToProcess(event, proc, config, currentLunaHostCLI);
        event.sender.send('auto-process-selected', proc);
        break;
      }
    }
  
    return processList;
  });

  ipcMain.on('select-process', async (event, processData) => {
    if (!isSetupComplete) {
      event.sender.send('log', { type: 'error', message: 'Cannot select process until setup is complete.' });
      return;
    }
    event.sender.send('log', { type: 'info', message: `Selected process: ${processData.name} (PID: ${processData.pid})` });
    attachToProcess(event, processData, config, currentLunaHostCLI);
  });

  ipcMain.on('send-text-to-second', (event, data) => {
    state.currentText = data.text || '';
    state.currentExeName = data.name || '';

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