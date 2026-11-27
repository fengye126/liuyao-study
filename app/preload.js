const { contextBridge, ipcRenderer } = require('electron');

let MEDIA_ROOT = '';
try { MEDIA_ROOT = ipcRenderer.sendSync('media:rootSync') || ''; } catch (e) {}

contextBridge.exposeInMainWorld('desktop', {
  mediaRoot: MEDIA_ROOT,
  mediaInfo: () => ipcRenderer.invoke('media:info'),
  rescanMedia: () => ipcRenderer.invoke('media:scan'),
  chooseMediaRoot: () => ipcRenderer.invoke('media:chooseRoot'),
  revealMediaRoot: () => ipcRenderer.invoke('media:revealRoot'),
  info: () => ipcRenderer.invoke('app:info'),
  load: (name) => ipcRenderer.invoke('data:load', name),
  save: (name, value) => ipcRenderer.invoke('data:save', name, value),
  importBackground: () => ipcRenderer.invoke('background:import'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  importData: () => ipcRenderer.invoke('data:import'),
  dataStatus: () => ipcRenderer.invoke('data:status'),
  lanInfo: () => ipcRenderer.invoke('lan:info'),
  lanRegenPair: () => ipcRenderer.invoke('lan:regenPair'),
  lanPushCases: (list) => ipcRenderer.invoke('lan:pushCases', list),
  mobileList: () => ipcRenderer.invoke('mobile:list'),
  mobileAck: (id) => ipcRenderer.invoke('mobile:ack', id),
  lanAudit: () => ipcRenderer.invoke('lan:audit'),
  openPdf: (href) => ipcRenderer.invoke('pdf:open', href),
  openPdfInApp: (href) => ipcRenderer.invoke('pdf:openInApp', href)
});
