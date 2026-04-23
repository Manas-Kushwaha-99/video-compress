const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const {
  getFfmpegPath,
  buildFfmpegCommand,
  getAudioCodecForFormat,
  getQualityCrf,
  twitterCompressionArgs,
  isOriginalQuality,
} = require("./ffmpeg-utils");

let mainWindow;
let ffmpegAvailable = false;
let gpuAvailable = false;
let gpuEncoder = null;

function getFfmpegExecutable() {
  const ffmpegDir = app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg")
    : path.join(__dirname, "ffmpeg");

  if (process.platform === "win32") {
    return path.join(ffmpegDir, "ffmpeg.exe");
  }
  return path.join(ffmpegDir, "ffmpeg");
}

function getFfprobeExecutable() {
  const ffmpegDir = app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg")
    : path.join(__dirname, "ffmpeg");

  if (process.platform === "win32") {
    return path.join(ffmpegDir, "ffprobe.exe");
  }
  return path.join(ffmpegDir, "ffprobe");
}

async function checkFfmpegAvailable() {
  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegExecutable();
    const proc = spawn(ffmpegPath, ["-version"]);
    proc.on("close", (code) => {
      resolve(code === 0);
    });
    proc.on("error", () => {
      resolve(false);
    });
  });
}

async function checkGpuAvailable() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      resolve(false);
      return;
    }
    const proc = spawn("nvidia-smi", [
      "--query-gpu=name",
      "--format=csv,noheader",
    ]);
    let output = "";
    proc.stdout.on("data", (data) => {
      output += data.toString().trim();
    });
    proc.on("close", (code) => {
      if (code === 0 && output.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    proc.on("error", () => {
      resolve(false);
    });
  });
}

function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    const ffprobePath = getFfprobeExecutable();
    const proc = spawn(ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);

    let output = "";
    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && output.trim()) {
        resolve(parseFloat(output.trim()));
      } else {
        reject(new Error("Could not get video duration"));
      }
    });

    proc.on("error", reject);
  });
}

function getVideoBitrate(inputPath) {
  return new Promise((resolve, reject) => {
    const ffprobePath = getFfprobeExecutable();

    // First try: get bit_rate from format metadata
    const proc = spawn(ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "format=bit_rate",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);

    let output = "";
    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && output.trim() && output.trim() !== "N/A") {
        const bitrate = parseInt(output.trim(), 10);
        if (bitrate > 0) {
          resolve(bitrate);
          return;
        }
      }

      // Fallback: calculate bitrate from packet sizes and duration
      calculateBitrateFromPackets(ffprobePath, inputPath)
        .then(resolve)
        .catch(() => resolve(0)); // Return 0 if all methods fail
    });

    proc.on("error", reject);
  });
}

function calculateBitrateFromPackets(ffprobePath, inputPath) {
  return new Promise((resolve, reject) => {
    // Get video stream duration and total packet size
    const proc = spawn(ffprobePath, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=duration:packet=size",
      "-of",
      "csv=p=0",
      inputPath,
    ]);

    let output = "";
    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("Failed to get packet info"));
        return;
      }

      const lines = output.trim().split("\n");
      let totalBytes = 0;
      let duration = 0;

      for (const line of lines) {
        const parts = line.split(",");
        if (parts.length >= 2) {
          const size = parseFloat(parts[1]);
          const dur = parseFloat(parts[0]);
          if (!isNaN(size)) totalBytes += size;
          if (!isNaN(dur) && dur > duration) duration = dur;
        }
      }

      if (totalBytes > 0 && duration > 0) {
        // bitrate = (total_bytes * 8) / duration = bits per second
        const bitrate = Math.round((totalBytes * 8) / duration);
        resolve(bitrate);
      } else {
        reject(new Error("Could not calculate bitrate"));
      }
    });

    proc.on("error", reject);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(async () => {
  ffmpegAvailable = await checkFfmpegAvailable();
  gpuAvailable = await checkGpuAvailable();

  if (gpuAvailable) {
    gpuEncoder = "h264_nvenc";
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("get-system-info", async () => {
  return {
    ffmpegAvailable,
    gpuAvailable,
    gpuEncoder,
    platform: process.platform,
  };
});

ipcMain.handle("select-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      {
        name: "Video Files",
        extensions: [
          "mp4",
          "m4v",
          "avi",
          "mov",
          "wmv",
          "mkv",
          "flv",
          "ogv",
          "webm",
          "h264",
          "hevc",
        ],
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const stat = fs.statSync(filePath);
  const fileName = path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase().substring(1);

  return {
    path: filePath,
    name: fileName,
    size: stat.size,
    extension,
  };
});

ipcMain.handle("get-video-duration", async (event, inputPath) => {
  try {
    const duration = await getVideoDuration(inputPath);
    return duration;
  } catch (error) {
    console.error("Error getting video duration:", error);
    return null;
  }
});

ipcMain.handle("get-video-bitrate", async (event, inputPath) => {
  try {
    const bitrate = await getVideoBitrate(inputPath);
    return bitrate;
  } catch (error) {
    console.error("Error getting video bitrate:", error);
    return null;
  }
});

ipcMain.handle(
  "compress-video",
  async (
    event,
    {
      inputPath,
      outputPath,
      outputFormat,
      quality,
      removeAudio,
      startTime,
      endTime,
      twitterPreset,
    }
  ) => {
    return new Promise(async (resolve, reject) => {
      try {
        const ffmpegPath = getFfmpegExecutable();
        const duration = await getVideoDuration(inputPath);
        const videoBitrate = await getVideoBitrate(inputPath);

        let args = [];

        if (twitterPreset) {
          args = [
            "-i",
            inputPath,
            ...twitterCompressionArgs(outputFormat),
          ];
          if (removeAudio) {
            args.push("-an");
          }
          args.push(outputPath);
        } else {
          args = buildFfmpegCommand({
            inputPath,
            outputPath,
            outputFormat,
            quality,
            removeAudio,
            startTime,
            endTime,
            gpuEncoder,
            videoBitrate,
          });
        }

        console.log("FFmpeg command:", ffmpegPath, args.join(" "));

        const proc = spawn(ffmpegPath, args);

        let stderrData = "";
        let errorOutput = "";

        proc.stderr.on("data", (data) => {
          const chunk = data.toString();
          stderrData += chunk;
          errorOutput += chunk;

          const timeMatch = chunk.match(
            /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/
          );
          if (timeMatch && duration > 0) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseInt(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const progress = Math.min(
              (currentTime / duration) * 100,
              100
            ).toFixed(1);
            mainWindow.webContents.send("compression-progress", {
              progress,
              currentTime,
              duration,
            });
          }
        });

        proc.on("close", (code) => {
          if (code === 0) {
            const stat = fs.statSync(outputPath);
            resolve({
              success: true,
              outputPath,
              outputSize: stat.size,
            });
          } else {
            // If using original quality (copy mode) and it failed, retry with re-encoding
            if (isOriginalQuality(quality) && !twitterPreset) {
              console.log("Copy mode failed, falling back to re-encoding...");
              const reencodeArgs = buildFfmpegCommand({
                inputPath,
                outputPath,
                outputFormat,
                quality: "medium",
                removeAudio,
                startTime,
                endTime,
                gpuEncoder,
                videoBitrate,
              });
              console.log("FFmpeg re-encode command:", ffmpegPath, reencodeArgs.join(" "));
              const reencodeProc = spawn(ffmpegPath, reencodeArgs);
              let reencodeError = "";
              reencodeProc.stderr.on("data", (data) => {
                const chunk = data.toString();
                stderrData += chunk;
                reencodeError += chunk;
                const timeMatch = chunk.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (timeMatch && duration > 0) {
                  const hours = parseInt(timeMatch[1]);
                  const minutes = parseInt(timeMatch[2]);
                  const seconds = parseInt(timeMatch[3]);
                  const currentTime = hours * 3600 + minutes * 60 + seconds;
                  const progress = Math.min((currentTime / duration) * 100, 100).toFixed(1);
                  mainWindow.webContents.send("compression-progress", {
                    progress,
                    currentTime,
                    duration,
                  });
                }
              });
              reencodeProc.on("close", (reencodeCode) => {
                if (reencodeCode === 0) {
                  const stat = fs.statSync(outputPath);
                  resolve({
                    success: true,
                    outputPath,
                    outputSize: stat.size,
                    fallbackUsed: true,
                  });
                } else {
                  console.error("FFmpeg re-encode stderr:", reencodeError);
                  resolve({
                    success: false,
                    error: `Conversion failed and re-encoding also failed. FFmpeg exited with code ${reencodeCode}. ${reencodeError.substring(0, 500)}`,
                  });
                }
              });
              reencodeProc.on("error", (err) => {
                resolve({
                  success: false,
                  error: `Failed to start FFmpeg re-encode: ${err.message}`,
                });
              });
            } else {
              console.error("FFmpeg stderr:", errorOutput);
              resolve({
                success: false,
                error: `FFmpeg exited with code ${code}. ${errorOutput.substring(0, 500)}`,
              });
            }
          }
        });

        proc.on("error", (err) => {
          resolve({
            success: false,
            error: `Failed to start FFmpeg: ${err.message}`,
          });
        });
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
        });
      }
    });
  }
);

ipcMain.handle("select-output-path", async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      {
        name: "Video Files",
        extensions: [
          "mp4",
          "m4v",
          "avi",
          "mov",
          "wmv",
          "mkv",
          "flv",
          "ogv",
          "webm",
        ],
      },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
});

ipcMain.handle("get-file-info", async (event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      size: stat.size,
      path: filePath,
    };
  } catch (error) {
    return null;
  }
});

ipcMain.handle("open-item-in-folder", async (event, filePath) => {
  const { shell } = require("electron");
  shell.showItemInFolder(filePath);
});

ipcMain.handle("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle("window-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle("window-close", () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle("window-is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});
