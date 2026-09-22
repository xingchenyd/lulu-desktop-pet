const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("luluDesktop", {
  dragStart: (x, y) => ipcRenderer.send("window:drag-start", { x, y }),
  dragMove: (x, y) => ipcRenderer.send("window:drag-move", { x, y }),
  dragEnd: () => ipcRenderer.send("window:drag-end"),
  moveBy: (x, y = 0) => ipcRenderer.invoke("window:move-by", { x, y }),
  showContextMenu: () => ipcRenderer.send("pet:context-menu"),
  setSetting: (key, value) => ipcRenderer.send("pet:set-setting", { key, value }),
  openLibrary: () => ipcRenderer.send("pet:open-library"),
  triggerAction: (action) => ipcRenderer.send("pet:trigger-action", action),
  getQuickActions: () => ipcRenderer.invoke("pet:get-quick-actions"),
  setQuickActions: (actions) => ipcRenderer.invoke("pet:set-quick-actions", actions),
  onAction: (callback) => {
    ipcRenderer.on("pet:action", (_event, action) => callback(action));
  },
  onSetting: (callback) => {
    ipcRenderer.on("pet:setting", (_event, setting) => callback(setting));
  },
  onQuickActions: (callback) => {
    ipcRenderer.on("pet:quick-actions", (_event, actions) => callback(actions));
  },
});
