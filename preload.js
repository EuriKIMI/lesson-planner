const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("eduPlanDesktop", {
  exportPdf: (lesson) => ipcRenderer.invoke("eduplan:export-pdf", lesson),
  generateLesson: (payload) => ipcRenderer.invoke("eduplan:generate-lesson", payload)
});
