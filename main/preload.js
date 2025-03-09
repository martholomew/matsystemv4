import { contextBridge, ipcRenderer } from 'electron';
import { injectBrowserAction } from 'electron-chrome-extensions/browser-action';

if (location.protocol === 'file:') {
  injectBrowserAction();
}

contextBridge.exposeInMainWorld('ipc', {
  getProcessList: () => ipcRenderer.invoke('get-process-list'),
  selectProcess: (pid) => ipcRenderer.send('select-process', pid),
  onProcessDetails: (callback) =>
    ipcRenderer.on('process-details', (event, details) => callback(details)),
  onLunahostLog: (callback) =>
    ipcRenderer.on('lunahost-log', (event, output) => callback(output)),
  onLunahostThread: (callback) =>
    ipcRenderer.on('lunahost-thread', (event, output) => callback(output)),
  onError: (callback) =>
    ipcRenderer.on('error', (event, error) => callback(error)),
  sendText: (data) => ipcRenderer.send('send-text-to-second', data),
  onUpdateText: (callback) =>
    ipcRenderer.on('update-text', (event, data) => callback(data)),
  saveConfiguration: (exeName, config) => ipcRenderer.send('saveConfiguration', exeName, config),
  onConfigurationLoaded: (callback) => ipcRenderer.on('configurationLoaded', (event, config) => callback(config)),
  openNewWindow: () => ipcRenderer.send('open-new-window'),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', ignore),
  sendBounds: (bounds) => ipcRenderer.send('set-bounds', bounds),
  getConfiguration: (exeName) => ipcRenderer.invoke('get-configuration', exeName),
});