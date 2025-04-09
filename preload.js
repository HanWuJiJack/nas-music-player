const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServers: (servers) => ipcRenderer.invoke('save-servers', servers),
  connectToServer: (serverId) => ipcRenderer.invoke('connect-to-server', serverId),
  listFiles: (config) => ipcRenderer.invoke('list-files', config),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  file: {
    getStream: (config) => ipcRenderer.invoke('get-file-stream', {
      ...config,
      mode: config.mode || 'local'
    })
  },
  getLyrics: (songName) => ipcRenderer.invoke('get-lyrics', songName),
  local: {
    listFiles: (path) => ipcRenderer.invoke('list-local-files', path),
    chooseDirectory: () => ipcRenderer.invoke('open-directory-dialog'),
  }
})