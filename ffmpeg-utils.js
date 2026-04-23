const path = require("path");

function getFfmpegPath() {
  const { app } = require("electron");
  const ffmpegDir = app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg")
    : path.join(__dirname, "ffmpeg");

  if (process.platform === "win32") {
    return path.join(ffmpegDir, "ffmpeg.exe");
  }
  return path.join(ffmpegDir, "ffmpeg");
}

function getQualityCrf(quality) {
  const qualityMap = {
    high: 15,
    medium: 18,
    low: 20,
  };
  return qualityMap[quality] || 18;
}

function isOriginalQuality(quality) {
  return quality === "original";
}

function getAudioCodecForFormat(format) {
  const codecMap = {
    mp4: "aac",
    webm: "libvorbis",
    avi: "mp3",
    mkv: "aac",
    flv: "aac",
    mov: "aac",
  };
  return codecMap[format] || "aac";
}

function getTwitterCommand() {
  return [
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level:v", "4.2",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "faststart",
    "-r", "30",
    "-maxrate", "5000k",
    "-bufsize", "5000k",
    "-tune", "film",
    "-preset", "slow",
  ];
}

function getCopyCommand(startTime, endTime, removeAudio) {
  const args = [];
  if (startTime > 0) args.push("-ss", String(startTime));
  if (endTime > 0) args.push("-to", String(endTime));
  args.push("-c", "copy");
  if (removeAudio) {
    args.push("-an");
  }
  return args;
}

function getMp4Command(quality, startTime, endTime, removeAudio, videoBitrate) {
  const crf = getQualityCrf(quality);

  let maxrate, bufsize;
  if (quality === "low") {
    if (videoBitrate) {
      maxrate = `${Math.round((videoBitrate * 0.25) / 1000)}k`;
      bufsize = `${Math.round((videoBitrate * 0.50) / 1000)}k`;
    } else {
      maxrate = "5000k";
      bufsize = "5000k";
    }
  } else if (videoBitrate) {
    if (quality === "high") {
      maxrate = `${Math.round((videoBitrate * 0.75) / 1000)}k`;
      bufsize = `${Math.round(videoBitrate / 1000)}k`;
    } else if (quality === "medium") {
      maxrate = `${Math.round((videoBitrate * 0.5) / 1000)}k`;
      bufsize = `${Math.round((videoBitrate * 0.75) / 1000)}k`;
    } else {
      maxrate = `${Math.round(videoBitrate / 1000)}k`;
      bufsize = `${Math.round((videoBitrate * 1.5) / 1000)}k`;
    }
  } else {
    maxrate = "5000k";
    bufsize = "5000k";
  }

  const args = [
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level:v", "4.2",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-maxrate", maxrate,
    "-bufsize", bufsize,
    "-preset", "slow",
    "-tune", "film",
  ];

  if (startTime > 0) args.push("-ss", String(startTime));
  if (endTime > 0) args.push("-to", String(endTime));

  args.push("-crf", String(crf), "-f", "mp4");

  if (!removeAudio) {
    args.push("-c:a", "aac", "-b:a", "192k", "-movflags", "faststart");
  } else {
    args.push("-an");
  }

  return args;
}

function getWebMCommand(quality, startTime, endTime, removeAudio) {
  const crf = getQualityCrf(quality);
  const args = [
    "-c:v", "libvpx",
    "-crf", String(crf),
    "-b:v", "1M",
    "-preset", "slow",
  ];

  if (!removeAudio) {
    args.push("-c:a", "libvorbis");
  }

  if (startTime > 0 || endTime > 0) {
    const trimParts = [];
    if (startTime > 0) trimParts.push(`start=${startTime}`);
    if (endTime > 0) trimParts.push(`end=${endTime}`);
    args.push("-vf", `trim=${trimParts.join(":")}`);
  }

  return args;
}

function getGenericCommand(format, quality, startTime, endTime, removeAudio, videoBitrate) {
  const crf = getQualityCrf(quality);
  const audioCodec = getAudioCodecForFormat(format);

  let maxrate, bufsize;
  if (quality === "low") {
    if (videoBitrate) {
      maxrate = `${Math.round((videoBitrate * 0.25) / 1000)}k`;
      bufsize = `${Math.round((videoBitrate * 0.50) / 1000)}k`;
    } else {
      maxrate = "5000k";
      bufsize = "5000k";
    }
  } else if (videoBitrate) {
    if (quality === "high") {
      maxrate = `${Math.round((videoBitrate * 0.75) / 1000)}k`;
      bufsize = `${Math.round(videoBitrate / 1000)}k`;
    } else if (quality === "medium") {
      maxrate = `${Math.round((videoBitrate * 0.5) / 1000)}k`;
      bufsize = `${Math.round((videoBitrate * 0.75) / 1000)}k`;
    } else {
      maxrate = `${Math.round(videoBitrate / 1000)}k`;
      bufsize = `${Math.round((videoBitrate * 1.5) / 1000)}k`;
    }
  } else {
    maxrate = "2000k";
    bufsize = "3000k";
  }

  const args = [
    "-c:v", "libx264",
    "-crf", String(crf),
    "-maxrate", maxrate,
    "-bufsize", bufsize,
    "-preset", "slow",
  ];

  if (!removeAudio) {
    args.push("-c:a", audioCodec);
  } else {
    args.push("-an");
  }

  if (startTime > 0 || endTime > 0) {
    const trimParts = [];
    if (startTime > 0) trimParts.push(`start=${startTime}`);
    if (endTime > 0) trimParts.push(`end=${endTime}`);
    args.push("-vf", `trim=${trimParts.join(":")}`);
  }

  return args;
}

function getMKVCommand(quality, startTime, endTime, removeAudio, videoBitrate) {
  return getGenericCommand("mkv", quality, startTime, endTime, removeAudio, videoBitrate);
}

function getAVICommand(quality, startTime, endTime, removeAudio, videoBitrate) {
  return getGenericCommand("avi", quality, startTime, endTime, removeAudio, videoBitrate);
}

function getFLVCommand(quality, startTime, endTime, removeAudio, videoBitrate) {
  return getGenericCommand("flv", quality, startTime, endTime, removeAudio, videoBitrate);
}

function getMOVCommand(quality, startTime, endTime, removeAudio, videoBitrate) {
  return getGenericCommand("mov", quality, startTime, endTime, removeAudio, videoBitrate);
}

function twitterCompressionArgs(outputFormat) {
  return getTwitterCommand();
}

function buildFfmpegCommand({
  inputPath,
  outputPath,
  outputFormat,
  quality,
  removeAudio,
  startTime,
  endTime,
  gpuEncoder,
  videoBitrate,
}) {
  const args = ["-i", inputPath];

  let formatArgs;

  if (isOriginalQuality(quality)) {
    formatArgs = getCopyCommand(startTime, endTime, removeAudio);
  } else if (outputFormat === "mp4") {
    formatArgs = getMp4Command(quality, startTime, endTime, removeAudio, videoBitrate);
  } else if (outputFormat === "webm") {
    formatArgs = getWebMCommand(quality, startTime, endTime, removeAudio);
  } else if (outputFormat === "mkv") {
    formatArgs = getMKVCommand(quality, startTime, endTime, removeAudio, videoBitrate);
  } else if (outputFormat === "avi") {
    formatArgs = getAVICommand(quality, startTime, endTime, removeAudio, videoBitrate);
  } else if (outputFormat === "flv") {
    formatArgs = getFLVCommand(quality, startTime, endTime, removeAudio, videoBitrate);
  } else if (outputFormat === "mov") {
    formatArgs = getMOVCommand(quality, startTime, endTime, removeAudio, videoBitrate);
  } else {
    formatArgs = getGenericCommand(outputFormat, quality, startTime, endTime, removeAudio, videoBitrate);
  }

  args.push(...formatArgs);
  args.push(outputPath);

  return args;
}

module.exports = {
  getFfmpegPath,
  getQualityCrf,
  getAudioCodecForFormat,
  getGpuEncoderArgs: () => [],
  getCpuEncoderArgs: () => [],
  twitterCompressionArgs,
  buildFfmpegCommand,
  isOriginalQuality,
};
