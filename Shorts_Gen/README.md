# ⚽ Football Viral Shorts Generator

Automatically turn your football highlight videos into viral-ready short clips — ready for **Instagram Reels**, **YouTube Shorts**, and **Facebook Reels**.

---

## 🚀 Quick Start

### macOS / Linux
```bash
bash run.sh
```

### Windows
Double-click `run.bat`

### Manual
```bash
pip install moviepy opencv-python numpy scipy
python app.py
```

---

## 🎬 How It Works

1. **Add Videos** — load your football highlight MP4/MOV/AVI files
2. **Choose Music** — pick an epic background track (MP3/WAV/OGG)
3. **Select Effects** — zoom punch, vignette, color boost, etc.
4. **Pick Volume Style** — build-up, drop, or steady
5. **Hit GO** — the app detects highlight moments, applies effects & music, and exports 9:16 vertical shorts to your Desktop

---

## 🤖 Auto Scene Detection

The app uses **optical flow / motion analysis** on every frame to find the most action-packed moments:

- Detects sudden bursts of motion (shots, tackles, goals)
- Adds a 2s pre-roll and 3s post-roll buffer around each peak
- Merges nearby moments into single clips
- Ranks by intensity score — takes the best N clips

**Sensitivity Modes:**
| Mode   | Best for |
|--------|----------|
| Low    | Only the most obvious goals/shots |
| Medium | Balanced — good for most videos |
| High   | Catches every touch and sprint |

---

## 🎨 Visual Effects

| Effect       | Description |
|--------------|-------------|
| Zoom Punch   | Slowly zooms in to 130% then releases — feels cinematic |
| Vignette     | Dark edges focus viewer on the action |
| Color Boost  | Saturates colors for a punchier look |
| Contrast     | Deeper blacks and brighter whites |
| Grayscale    | Classic black & white for dramatic moments |
| Slow Motion  | Half-speed for impact shots |
| Flash Cut    | White flash at the start of each clip |
| Crop 9:16    | Converts wide video to vertical for Reels/Shorts |

---

## 🎵 Music Tips

For maximum virality, use tracks with:
- A **clear drop** at ~60-70% through the song
- Heavy bass and percussion
- Popular football hype songs (Freed From Desire, Seven Nation Army, etc.)

**Volume styles:**
- **Build-Up** — music grows louder as the clip reaches the peak moment
- **Drop** — music goes quiet, then EXPLODES at the key moment
- **Steady** — consistent background music

---

## 📤 Output

All shorts are saved to:
```
~/Desktop/FootballShorts/
```

Files are named:
```
[original_name]_short_01_[timestamp].mp4
```

Ready to upload directly to:
- 📸 Instagram Reels
- ▶️ YouTube Shorts
- 📘 Facebook Reels

---

## ⚙️ Requirements

- Python 3.9+
- FFmpeg (auto-installed on most systems)
- `moviepy`, `opencv-python`, `numpy`, `scipy`

---

## 💡 Pro Tips

1. **Best results** come from videos that are 3–10 minutes long (full highlight reels)
2. Use **High sensitivity** for training sessions, **Medium** for match highlights
3. Choose **Crop 9:16** for Instagram/TikTok, uncheck for YouTube landscape
4. Set **Max Clips = 3–5** for quick exports, up to 10 for full coverage
5. Add **Color Boost + Vignette + Zoom Punch** together for the most viral look

---

## 🛡️ Copyright-Defeat Overlays (NEW in v3)

These overlays add **unique, frame-level visual noise** to your clips. Each frame is slightly different from the original, which disrupts Content ID fingerprinting on YouTube, Instagram, and Facebook.

| Overlay       | Description |
|---------------|-------------|
| ❄️ Winter Snow | Animated snowflakes drift across the screen — positions are unique per frame |
| 📺 Film Grain  | Per-frame random noise (~±18 px value) — the lightest, most effective option |
| 🔥 Fire Sparks | Rising warm spark particles — good for goal/celebration clips |
| ✨ Emoji Burst | Football emojis (⚽ 🔥 💥) pop on screen briefly, staggered timing |
| 🌧️ Rain Drops  | Thin vertical rain streaks — subtle and cinematic |

### Recommended combos
- **Safest / least visible**: Film Grain alone (barely noticeable to viewer)
- **Seasonal feel**: Winter Snow + Film Grain
- **High energy**: Fire Sparks + Emoji Burst + Film Grain
- **Rainy match day**: Rain Drops + Film Grain

> **Tip:** Film Grain is checked by default. It's the most effective because the noise is unique on *every single frame*, making the video visually unrecognizable to content fingerprinting systems.
