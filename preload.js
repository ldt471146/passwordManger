const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vault", {
  open: (password) => ipcRenderer.invoke("vault:open", password),
  create: (password) => ipcRenderer.invoke("vault:create", password),
  save: (password, data) => ipcRenderer.invoke("vault:save", password, data),
  revealPath: () => ipcRenderer.invoke("vault:revealPath"),
  exportJson: (data) => ipcRenderer.invoke("vault:exportJson", data),
  importJson: () => ipcRenderer.invoke("vault:importJson"),
  exportCsv: (data) => ipcRenderer.invoke("vault:exportCsv", data)
});
