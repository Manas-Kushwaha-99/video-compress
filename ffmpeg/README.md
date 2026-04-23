# FFmpeg Binaries

This app requires FFmpeg binaries to be placed in this folder for development and packaging.

## Download

Get the latest static build for your platform:
- **Official:** https://ffmpeg.org/download.html
- **Windows builds:** https://www.gyan.dev/ffmpeg/builds/ or https://github.com/BtbN/FFmpeg-Builds/releases
- **macOS:** `brew install ffmpeg` (then copy binaries from `/opt/homebrew/bin/`)
- **Linux:** Use your package manager (`apt`, `dnf`, `pacman`, etc.)

## Required Files

### Windows
- `ffmpeg.exe`
- `ffprobe.exe`

### macOS / Linux
- `ffmpeg`
- `ffprobe`

## Why aren't these in Git?

These binaries are **~425MB total**, which exceeds GitHub's file size limits. They are bundled into the final app installer by `electron-builder` via the `extraResources` config in `package.json`, but they should not be committed to source control.
