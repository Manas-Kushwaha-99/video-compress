const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  selectFile: () => ipcRenderer.invoke("select-file"),

  getVideoDuration: (inputPath) => ipcRenderer.invoke("get-video-duration", inputPath),

  getVideoBitrate: (inputPath) => ipcRenderer.invoke("get-video-bitrate", inputPath),

  compressVideo: (options) => ipcRenderer.invoke("compress-video", options),

  selectOutputPath: (defaultName) => ipcRenderer.invoke("select-output-path", defaultName),

  getFileInfo: (filePath) => ipcRenderer.invoke("get-file-info", filePath),

  onCompressionProgress: (callback) => {
    ipcRenderer.on("compression-progress", (event, data) => callback(data));
  },

  removeCompressionProgressListener: () => {
    ipcRenderer.removeAllListeners("compression-progress");
  },

  openItemInFolder: (filePath) => ipcRenderer.invoke("open-item-in-folder", filePath),

  windowMinimize: () => ipcRenderer.invoke("window-minimize"),

  windowMaximize: () => ipcRenderer.invoke("window-maximize"),

  windowClose: () => ipcRenderer.invoke("window-close"),

  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),
});
