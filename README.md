# Video Compress

A free, offline desktop video compression app built with Electron. Shrink video files without uploading anything to the cloud — all processing happens locally on your machine.

## Features

- **Truly Offline** — All compression happens locally; no uploads, no watermarks, no limits
- **Drag & Drop** — Simple drag-and-drop interface plus file picker
- **Format Conversion** — MP4, MKV, AVI, MOV, FLV, WEBM, and more
- **Quality Presets** — Original (conversion only), High, Medium, Low
- **Trim Videos** — Cut videos by specifying start and end times before compressing
- **Twitter/X Preset** — One-click optimization for social media uploads
- **Audio Removal** — Strip audio tracks to save extra space
- **Progress Tracking** — Real-time progress bar with time elapsed / total duration

## Screenshots

> _Add your screenshots here. Recommended: drag and drop images directly into the GitHub README editor after pushing._

<!-- ![App Screenshot](./screenshots/app.png) -->

## Download

Download the latest Windows release from the [Releases](https://github.com/Manas-Kushwaha-99/video-compress/releases) page.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- FFmpeg binaries (see setup below)

### 1. Clone the repository

```bash
git clone https://github.com/Manas-Kushwaha-99/video-compress.git
cd video-compress
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add FFmpeg binaries

FFmpeg binaries are **not included** in this repository because they are too large for GitHub.

1. Go to https://www.gyan.dev/ffmpeg/builds/
2. Under **Release builds**, download `ffmpeg-release-essentials.zip`
3. Extract the ZIP file
4. Open the extracted folder, then go to the `bin/` folder
5. Copy these two files into your project's `ffmpeg/` folder:
   - `ffmpeg.exe`
   - `ffprobe.exe`

> The `electron-builder` config bundles this folder into production builds automatically via `extraResources`.

### 4. Run in development mode

```bash
npm run dev
```

## Building

Build for Windows:

```bash
npm run build:win
```

Build outputs will appear in the `dist/` folder.

## Project Structure

```
video-compress/
├── main.js              # Electron main process (window, IPC, FFmpeg spawning)
├── preload.js           # Secure IPC bridge (contextBridge)
├── renderer.js          # Frontend UI logic (drag-drop, settings, progress)
├── ffmpeg-utils.js      # FFmpeg command builders & encoder selection
├── index.html           # App UI markup
├── styles.css           # App styles (dark theme)
├── package.json         # Dependencies & Electron Builder config
├── ffmpeg/              # FFmpeg binaries (not committed; see README inside)
└── public/              # Static assets
```

## Supported Formats

**Input containers:** MP4, M4V, MKV, AVI, MOV, WMV, FLV, OGV, WEBM  
**Output containers:** MP4, MKV, AVI, MOV, FLV, WEBM

The app also accepts raw H.264 and HEVC bitstream files (`.h264`, `.hevc`) as input.

## License

MIT License — see [LICENSE](./LICENSE).

## Acknowledgements

Parts of this project were built with assistance from AI tools.

---

Made by [Manas Kushwaha](https://github.com/Manas-Kushwaha-99)
