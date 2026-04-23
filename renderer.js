const dropZone = document.getElementById("dropZone");
const selectFileBtn = document.getElementById("selectFileBtn");
const removeFileBtn = document.getElementById("removeFileBtn");
const compressBtn = document.getElementById("compressBtn");
const compressAnotherBtn = document.getElementById("compressAnotherBtn");
const retryBtn = document.getElementById("retryBtn");
const openOutputBtn = document.getElementById("openOutputBtn");
const minimizeBtn = document.getElementById("minimizeBtn");
const maximizeBtn = document.getElementById("maximizeBtn");
const closeBtn = document.getElementById("closeBtn");

const uploadSection = document.getElementById("uploadSection");
const fileInfoSection = document.getElementById("fileInfoSection");
const settingsSection = document.getElementById("settingsSection");
const progressSection = document.getElementById("progressSection");
const resultSection = document.getElementById("resultSection");
const errorSection = document.getElementById("errorSection");

const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const fileDurationEl = document.getElementById("fileDuration");

const outputFormat = document.getElementById("outputFormat");
const removeAudio = document.getElementById("removeAudio");
const twitterPreset = document.getElementById("twitterPreset");
const startTimeInput = document.getElementById("startTime");
const endTimeInput = document.getElementById("endTime");

const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");
const progressTime = document.getElementById("progressTime");

const originalSizeEl = document.getElementById("originalSize");
const compressedSizeEl = document.getElementById("compressedSize");
const resultStats = document.querySelector(".result-stats");
const reductionPercentEl = document.getElementById("reductionPercent");

const errorMessageEl = document.getElementById("errorMessage");

const ffmpegDot = document.getElementById("ffmpegDot");
const ffmpegStatus = document.getElementById("ffmpegStatus");

let currentFile = null;
let outputFilePath = null;
let videoDuration = 0;
let videoBitrate = 0;

function bytesToSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Byte";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);
  return `${size} ${sizes[i]}`;
}

function formatTime(seconds) {
  seconds = Math.round(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getQuality() {
  const selected = document.querySelector('input[name="quality"]:checked');
  return selected ? selected.value : "medium";
}

function applyBitrateRestrictions() {
  // Bitrate restrictions removed - compression allowed for all videos
}

function showSection(section) {
  [uploadSection, fileInfoSection, settingsSection, progressSection, resultSection, errorSection].forEach((s) => {
    if (s === section) {
      s.style.display = "";
    } else {
      s.style.display = "none";
    }
  });
}

async function init() {
  const systemInfo = await window.electronAPI.getSystemInfo();

  if (systemInfo.ffmpegAvailable) {
    ffmpegDot.classList.add("available");
    ffmpegStatus.textContent = "FFmpeg Ready";
  } else {
    ffmpegDot.classList.add("unavailable");
    ffmpegStatus.textContent = "FFmpeg Missing";
  }


}

async function handleFileSelect() {
  const file = await window.electronAPI.selectFile();
  if (!file) return;

  currentFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = bytesToSize(file.size);

  const duration = await window.electronAPI.getVideoDuration(file.path);
  if (duration) {
    videoDuration = duration;
    fileDurationEl.textContent = formatTime(duration);
    endTimeInput.value = Math.floor(duration);
    endTimeInput.max = Math.floor(duration);
  } else {
    fileDurationEl.textContent = "Unknown";
    videoDuration = 0;
  }

  const bitrate = await window.electronAPI.getVideoBitrate(file.path);
  if (bitrate) {
    videoBitrate = bitrate;
    applyBitrateRestrictions();
  } else {
    videoBitrate = 0;
    applyBitrateRestrictions(0);
  }

  outputFilePath = null;
  showSection(fileInfoSection);
  settingsSection.style.display = "";
}

function resetUI() {
  currentFile = null;
  outputFilePath = null;
  videoDuration = 0;
  videoBitrate = 0;
  applyBitrateRestrictions(0);
  showSection(uploadSection);
  progressBar.style.width = "0%";
  progressPercent.textContent = "0%";
  progressTime.textContent = "00:00 / 00:00";
}

async function handleCompress() {
  if (!currentFile) return;

  const baseName = currentFile.name.replace(/\.[^/.]+$/, "");
  const format = outputFormat.value;
  const defaultOutputName = `${baseName}-compressed.${format}`;

  if (!outputFilePath) {
    outputFilePath = await window.electronAPI.selectOutputPath(defaultOutputName);
    if (!outputFilePath) return;
  }

  const startTime = parseFloat(startTimeInput.value) || 0;
  const endTime = parseFloat(endTimeInput.value) || 0;

  showSection(progressSection);
  compressBtn.disabled = true;

  window.electronAPI.onCompressionProgress((data) => {
    const percent = parseFloat(data.progress);
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressTime.textContent = `${formatTime(data.currentTime)} / ${formatTime(data.duration)}`;
  });

  const result = await window.electronAPI.compressVideo({
    inputPath: currentFile.path,
    outputPath: outputFilePath,
    outputFormat: format,
    quality: getQuality(),
    removeAudio: removeAudio.checked,
    startTime,
    endTime,
    twitterPreset: twitterPreset.checked,
  });

  window.electronAPI.removeCompressionProgressListener();
  compressBtn.disabled = false;

  if (result.success) {
    const quality = getQuality();
    if (quality === "original") {
      resultStats.style.display = "none";
    } else {
      resultStats.style.display = "";
      const reduction = ((currentFile.size - result.outputSize) / currentFile.size) * 100;
      originalSizeEl.textContent = bytesToSize(currentFile.size);
      compressedSizeEl.textContent = bytesToSize(result.outputSize);
      reductionPercentEl.textContent = `${Math.abs(reduction).toFixed(1)}%`;
    }
    showSection(resultSection);
  } else {
    errorMessageEl.textContent = result.error || "Compression failed";
    showSection(errorSection);
  }
}

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");

  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  const validExtensions = ["mp4", "m4v", "avi", "mov", "wmv", "mkv", "flv", "ogv", "webm", "h264", "hevc"];
  const ext = file.name.split(".").pop().toLowerCase();

  if (!validExtensions.includes(ext)) {
    errorMessageEl.textContent = `Unsupported file format: .${ext}`;
    showSection(errorSection);
    return;
  }

  currentFile = {
    name: file.name,
    path: file.path,
    size: file.size,
    extension: ext,
  };

  fileNameEl.textContent = currentFile.name;
  fileSizeEl.textContent = bytesToSize(currentFile.size);

  const duration = await window.electronAPI.getVideoDuration(currentFile.path);
  if (duration) {
    videoDuration = duration;
    fileDurationEl.textContent = formatTime(duration);
    endTimeInput.value = Math.floor(duration);
    endTimeInput.max = Math.floor(duration);
  } else {
    fileDurationEl.textContent = "Unknown";
    videoDuration = 0;
  }

  const bitrate = await window.electronAPI.getVideoBitrate(currentFile.path);
  if (bitrate) {
    videoBitrate = bitrate;
    applyBitrateRestrictions();
  } else {
    videoBitrate = 0;
    applyBitrateRestrictions(0);
  }

  outputFilePath = null;
  showSection(fileInfoSection);
  settingsSection.style.display = "";
});

selectFileBtn.addEventListener("click", handleFileSelect);
removeFileBtn.addEventListener("click", resetUI);
compressBtn.addEventListener("click", handleCompress);

compressAnotherBtn.addEventListener("click", resetUI);
retryBtn.addEventListener("click", resetUI);

openOutputBtn.addEventListener("click", async () => {
  if (outputFilePath) {
    await window.electronAPI.openItemInFolder(outputFilePath);
  }
});

minimizeBtn.addEventListener("click", () => {
  window.electronAPI.windowMinimize();
});

maximizeBtn.addEventListener("click", async () => {
  await window.electronAPI.windowMaximize();
  const isMaximized = await window.electronAPI.windowIsMaximized();
  maximizeBtn.innerHTML = isMaximized
    ? `<svg viewBox="0 0 12 12" width="12" height="12">
         <rect x="3" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
         <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
       </svg>`
    : `<svg viewBox="0 0 12 12" width="12" height="12">
         <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
       </svg>`;
});

closeBtn.addEventListener("click", () => {
  window.electronAPI.windowClose();
});

init();
