# VideoForge — Batch Video reducer




https://link-hub.net/5754265/zP2eW7WMx955



A beautiful dark-themed batch video quality converter built with Python + Tkinter + FFmpeg.

---

## Run locally (no Docker)

```bash
pip install tk          # usually pre-installed
# make sure ffmpeg is on your PATH
python video_converter.py
```

---

## Docker — build & run

### 1. Build the image

```bash
docker build -t videoforge .
```

### 2. Run with X11 forwarding

**Linux**
```bash
xhost +local:docker
docker run --rm \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v "$HOME/Videos:/videos" \
  videoforge
```

**macOS** (requires [XQuartz](https://www.xquartz.org/))
```bash
xhost + 127.0.0.1
docker run --rm \
  -e DISPLAY=host.docker.internal:0 \
  -v "$HOME/Videos:/videos" \
  videoforge
```

**Windows** (requires [VcXsrv](https://sourceforge.net/projects/vcxsrv/) or X410)
```powershell
docker run --rm `
  -e DISPLAY=host.docker.internal:0.0 `
  -v "C:/Users/YourName/Videos:/videos" `
  videoforge
```

### Volume note
Mount the folder that contains your source videos to `/videos` (or any path).  
Converted files are saved **next to the originals**, so the mounted folder works as both input and output.

---

## Quality options

| Label         | Height | Use case              |
|---------------|--------|-----------------------|
| 240p — Tiny   | 240px  | Tiny previews / SMS   |
| 320p — Small  | 320px  | Mobile data-saving    |
| 480p — SD     | 480px  | Standard definition   |
| 720p — HD     | 720px  | HD streaming (default)|
| 1080p — Full HD | 1080px | Full HD archival    |

---

## Tech stack
- **Python 3.11** · **Tkinter** (GUI)
- **FFmpeg** (libx264 + AAC, ultrafast preset)
- **Threading** — UI stays responsive during conversion



##RUN Container


-

docker run --rm   -e DISPLAY=$DISPLAY   -v /tmp/.X11-unix:/tmp/.X11-unix   -v /mnt/c/Users/bahid/Videos:/videos   bahida2026youssef/video-reducer
