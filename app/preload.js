const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  info: () => ipcRenderer.invoke('app:info'),
  load: (name) => ipcRenderer.invoke('data:load', name),
  save: (name, value) => ipcRenderer.invoke('data:save', name, value),
  importBackground: () => ipcRenderer.invoke('background:import'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  importData: () => ipcRenderer.invoke('data:import'),
  dataStatus: () => ipcRenderer.invoke('data:status'),
  lanInfo: () => ipcRenderer.invoke('lan:info'),
  openPdf: (href) => ipcRenderer.invoke('pdf:open', href)
});
