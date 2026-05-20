# ============================================================
#  VideoForge — Dockerfile
#  Runs a Tkinter GUI app inside Docker with X11 forwarding
# ============================================================
FROM python:3.11-slim

# ── System dependencies ──────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3-tk \
    tk-dev \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxtst6 \
    libxi6 \
    x11-utils \
    && rm -rf /var/lib/apt/lists/*

# ── App ──────────────────────────────────────────────────────
WORKDIR /app
COPY video_converter.py .

# ── Environment ──────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1

# Tkinter needs a DISPLAY variable – supplied at runtime via X11
CMD ["python3", "video_converter.py"]
