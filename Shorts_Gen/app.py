"""
⚽ Football Viral Shorts Generator
Cuts football highlights into viral-ready short clips with effects & music.
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import threading
import os
import sys
import json
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

# ─── Color Palette ───────────────────────────────────────────────────────────
BG       = "#0a0a0f"
BG2      = "#12121a"
BG3      = "#1a1a26"
CARD     = "#1e1e2e"
ACCENT   = "#00d4ff"
ACCENT2  = "#ff6b35"
GREEN    = "#00ff88"
YELLOW   = "#ffd700"
TEXT     = "#e8e8f0"
TEXT_DIM = "#888899"
BORDER   = "#2a2a40"

# ─── Paths ───────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
ASSETS_DIR = BASE_DIR / "assets"
MUSIC_DIR  = ASSETS_DIR / "music"
OUTPUT_DIR = Path.home() / "Desktop" / "FootballShorts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MUSIC_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
#  VIDEO PROCESSING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class VideoProcessor:
    """Core processing: scene detection → clip extraction → effects → music."""

    # Typical viral football moment durations (seconds)
    CLIP_MIN = 8
    CLIP_MAX = 30
    SHORT_TARGET_DURATION = 28   # aim for <30s for Reels/Shorts

    def __init__(self, log_fn=None):
        self.log = log_fn or print

    # ── Scene / Motion Detection ────────────────────────────────────────────

    def detect_moments(self, video_path: str, sensitivity: str = "medium") -> list[dict]:
        """
        Use ffmpeg scene detection + motion analysis to find highlight moments.
        Returns list of {start, end, score, type} dicts.
        """
        import cv2
        import numpy as np

        thresholds = {"low": 0.25, "medium": 0.40, "high": 0.55}
        scene_thresh = thresholds.get(sensitivity, 0.40)

        self.log(f"🔍 Analysing motion in: {Path(video_path).name}")

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps

        self.log(f"   Duration: {duration:.1f}s  |  FPS: {fps:.1f}")

        # Sample every Nth frame for speed
        sample_every = max(1, int(fps / 5))  # 5 samples/sec
        motion_scores = []
        prev_gray = None
        frame_idx = 0

        while True:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (320, 180))
            if prev_gray is not None:
                diff = cv2.absdiff(gray, prev_gray)
                score = float(np.mean(diff)) / 255.0
                motion_scores.append((frame_idx / fps, score))
            prev_gray = gray
            frame_idx += sample_every
            if frame_idx >= total_frames:
                break

        cap.release()

        if not motion_scores:
            self.log("⚠️  No motion data found, using uniform splits.")
            return self._uniform_splits(duration)

        # Find peaks (high-motion bursts = action moments)
        times   = [t for t, _ in motion_scores]
        scores  = [s for _, s in motion_scores]

        # Smooth scores
        window = 5
        smoothed = []
        for i in range(len(scores)):
            chunk = scores[max(0, i-window):i+window+1]
            smoothed.append(sum(chunk)/len(chunk))

        mean_s = sum(smoothed) / len(smoothed) if smoothed else 0
        std_s  = (sum((x - mean_s)**2 for x in smoothed) / len(smoothed))**0.5 if smoothed else 0
        threshold = mean_s + scene_thresh * std_s

        # Group consecutive high-motion frames into moments
        moments = []
        in_moment = False
        m_start = 0

        for i, (t, s) in enumerate(zip(times, smoothed)):
            if s >= threshold and not in_moment:
                in_moment = True
                m_start = max(0, t - 2)   # 2s pre-roll
            elif s < threshold and in_moment:
                in_moment = False
                m_end = min(duration, t + 3)  # 3s post-roll
                if (m_end - m_start) >= 5:    # must be at least 5s
                    peak = max(smoothed[i-20:i+1]) if i >= 20 else s
                    moments.append({
                        "start": round(m_start, 2),
                        "end":   round(min(m_end, m_start + self.CLIP_MAX), 2),
                        "score": round(peak, 4),
                        "type":  "action"
                    })

        if in_moment:
            moments.append({
                "start": round(m_start, 2),
                "end":   round(min(duration, m_start + self.CLIP_MAX), 2),
                "score": 0.5,
                "type":  "action"
            })

        # Merge moments that are <3s apart
        merged = []
        for m in sorted(moments, key=lambda x: x["start"]):
            if merged and m["start"] - merged[-1]["end"] < 3:
                merged[-1]["end"]   = max(merged[-1]["end"], m["end"])
                merged[-1]["score"] = max(merged[-1]["score"], m["score"])
            else:
                merged.append(m)

        if not merged:
            self.log("⚠️  No distinct moments found, using uniform splits.")
            return self._uniform_splits(duration)

        self.log(f"✅ Found {len(merged)} highlight moment(s)")
        return merged

    def _uniform_splits(self, duration: float) -> list[dict]:
        """Fall-back: evenly spaced clips."""
        clips = []
        step = 20.0
        t = 0
        while t < duration - 10:
            clips.append({
                "start": round(t, 2),
                "end":   round(min(t + step, duration), 2),
                "score": 0.5,
                "type":  "uniform"
            })
            t += step
        return clips

    # ── Effects ─────────────────────────────────────────────────────────────

    def apply_effects(self, clip, effects: list[str], peak_ratio: float = 0.5):
        """Apply selected visual effects to a moviepy clip."""
        from moviepy import vfx, VideoClip
        import numpy as np

        for fx in effects:

            if fx == "grayscale":
                clip = clip.with_effects([vfx.BlackAndWhite()])

            elif fx == "zoom_punch":
                # Zoom in to 130% at peak, back out
                orig_w, orig_h = clip.size
                def zoom_filter(get_frame, t):
                    dur = clip.duration
                    # build-up then release
                    prog = t / dur if dur > 0 else 0
                    if prog < 0.5:
                        scale = 1.0 + 0.30 * (prog / 0.5)
                    else:
                        scale = 1.30 - 0.30 * ((prog - 0.5) / 0.5)
                    frame = get_frame(t)
                    h, w = frame.shape[:2]
                    new_w = int(w * scale)
                    new_h = int(h * scale)
                    import cv2
                    resized = cv2.resize(frame, (new_w, new_h))
                    x1 = (new_w - w) // 2
                    y1 = (new_h - h) // 2
                    return resized[y1:y1+h, x1:x1+w]
                clip = clip.transform(zoom_filter)

            elif fx == "vignette":
                def vignette_filter(get_frame, t):
                    frame = get_frame(t)
                    h, w = frame.shape[:2]
                    Y, X = np.ogrid[:h, :w]
                    cx, cy = w/2, h/2
                    dist = np.sqrt(((X - cx)/cx)**2 + ((Y - cy)/cy)**2)
                    mask = np.clip(1 - 0.7 * dist**2, 0, 1)
                    return (frame * mask[:, :, np.newaxis]).astype(frame.dtype)
                clip = clip.transform(vignette_filter)

            elif fx == "slow_motion":
                clip = clip.with_effects([vfx.MultiplySpeed(0.5)])

            elif fx == "color_boost":
                def boost_filter(get_frame, t):
                    frame = get_frame(t).astype(np.float32)
                    frame = np.clip(frame * 1.25, 0, 255).astype(np.uint8)
                    return frame
                clip = clip.transform(boost_filter)

            elif fx == "contrast":
                clip = clip.with_effects([vfx.LumContrast(lum=0, contrast=0.35, contrast_threshold=127)])

            elif fx == "flash_cut":
                # Brief white flash at the start
                def flash_filter(get_frame, t):
                    frame = get_frame(t)
                    if t < 0.15:
                        alpha = 1 - (t / 0.15)
                        white = np.ones_like(frame, dtype=np.float32) * 255
                        return (alpha * white + (1 - alpha) * frame.astype(np.float32)).astype(np.uint8)
                    return frame
                clip = clip.transform(flash_filter)

            elif fx == "crop_vertical":
                # Crop to 9:16 for Reels/Shorts
                w, h = clip.size
                target_w = int(h * 9 / 16)
                if target_w < w:
                    x1 = (w - target_w) // 2
                    clip = clip.with_effects([vfx.Crop(x1=x1, x2=x1+target_w)])

            # ── Copyright-defeat overlays ────────────────────────────────────

            elif fx == "film_grain":
                # Randomized per-frame noise — breaks content-ID fingerprinting
                rng = np.random.default_rng(42)
                def grain_filter(get_frame, t):
                    frame = get_frame(t).astype(np.int16)
                    h, w = frame.shape[:2]
                    # Unique seed per frame so noise pattern is never the same
                    seed = int(t * 10000) % (2**31)
                    local_rng = np.random.default_rng(seed)
                    noise = local_rng.integers(-18, 19, size=(h, w, 3), dtype=np.int16)
                    return np.clip(frame + noise, 0, 255).astype(np.uint8)
                clip = clip.transform(grain_filter)

            elif fx == "winter_snow":
                # Animated snowflakes — each frame gets unique particle positions
                clip_w, clip_h = clip.size
                fps_est = clip.fps or 30
                # Pre-generate flake state: x, y, speed, size, wobble_offset
                n_flakes = 60
                rng2 = np.random.default_rng(7)
                flake_x   = rng2.uniform(0, clip_w, n_flakes)
                flake_y   = rng2.uniform(0, clip_h, n_flakes)
                flake_spd = rng2.uniform(1.5, 4.5, n_flakes)   # px/frame
                flake_sz  = rng2.integers(2, 7, n_flakes)
                flake_wob = rng2.uniform(0, 2*np.pi, n_flakes)  # phase

                def snow_filter(get_frame, t):
                    frame = get_frame(t).copy()
                    frame_idx = int(t * fps_est)
                    h, w = frame.shape[:2]
                    for i in range(n_flakes):
                        # Drift down + horizontal wobble
                        cy = int((flake_y[i] + flake_spd[i] * frame_idx) % h)
                        cx = int((flake_x[i] + 4 * np.sin(flake_wob[i] + frame_idx * 0.08)) % w)
                        r  = int(flake_sz[i])
                        # Draw soft white circle
                        import cv2 as _cv2
                        _cv2.circle(frame, (cx, cy), r, (220, 235, 255), -1, lineType=_cv2.LINE_AA)
                        # Soft halo
                        overlay = frame.copy()
                        _cv2.circle(overlay, (cx, cy), r + 2, (200, 220, 255), -1, lineType=_cv2.LINE_AA)
                        frame = _cv2.addWeighted(frame, 0.85, overlay, 0.15, 0)
                    return frame
                clip = clip.transform(snow_filter)

            elif fx == "rain_drops":
                # Vertical rain streaks with random positions per frame
                clip_w, clip_h = clip.size
                fps_est = clip.fps or 30
                n_drops = 80
                rng3 = np.random.default_rng(13)
                drop_x   = rng3.uniform(0, clip_w, n_drops)
                drop_y   = rng3.uniform(0, clip_h, n_drops)
                drop_spd = rng3.uniform(8, 20, n_drops)
                drop_len = rng3.integers(8, 22, n_drops)

                def rain_filter(get_frame, t):
                    import cv2 as _cv2
                    frame = get_frame(t).copy()
                    h, w = frame.shape[:2]
                    frame_idx = int(t * fps_est)
                    overlay = frame.copy()
                    for i in range(n_drops):
                        cy = int((drop_y[i] + drop_spd[i] * frame_idx) % h)
                        cx = int(drop_x[i] % w)
                        y2 = min(h - 1, cy + int(drop_len[i]))
                        _cv2.line(overlay, (cx, cy), (cx, y2), (180, 200, 230), 1, lineType=_cv2.LINE_AA)
                    frame = _cv2.addWeighted(frame, 0.92, overlay, 0.08, 0)
                    return frame
                clip = clip.transform(rain_filter)

            elif fx == "fire_sparks":
                # Random rising spark particles — warm orange/yellow dots
                clip_w, clip_h = clip.size
                fps_est = clip.fps or 30
                n_sparks = 40
                rng4 = np.random.default_rng(99)
                spark_x   = rng4.uniform(0.1, 0.9, n_sparks)   # relative x
                spark_y   = rng4.uniform(0.5, 1.0, n_sparks)   # start in lower half
                spark_spd = rng4.uniform(1.5, 4.0, n_sparks)   # rise speed
                spark_sz  = rng4.integers(2, 5, n_sparks)
                spark_wob = rng4.uniform(0, 2*np.pi, n_sparks)
                # Each spark has a colour: orange/yellow/red
                spark_clr = [(255, int(c), 0) for c in rng4.integers(50, 220, n_sparks)]

                def fire_filter(get_frame, t):
                    import cv2 as _cv2
                    frame = get_frame(t).copy()
                    h, w = frame.shape[:2]
                    frame_idx = int(t * fps_est)
                    for i in range(n_sparks):
                        rise = (spark_spd[i] * frame_idx) / h
                        rel_y = (spark_y[i] - rise) % 1.0
                        cx = int((spark_x[i] + 0.03 * np.sin(spark_wob[i] + frame_idx * 0.12)) * w) % w
                        cy = int(rel_y * h)
                        r = int(spark_sz[i])
                        _cv2.circle(frame, (cx, cy), r, spark_clr[i], -1, lineType=_cv2.LINE_AA)
                        # Glow ring
                        overlay = frame.copy()
                        _cv2.circle(overlay, (cx, cy), r + 2, (255, 200, 80), -1, lineType=_cv2.LINE_AA)
                        frame = _cv2.addWeighted(frame, 0.9, overlay, 0.1, 0)
                    return frame
                clip = clip.transform(fire_filter)

            elif fx == "emoji_burst":
                # Renders small text "emojis" (unicode chars via PIL) randomly on frames
                clip_w, clip_h = clip.size
                fps_est = clip.fps or 30
                symbols = ["⚽", "🔥", "💥", "⚡", "🏆", "👏", "🎯", "💫"]
                n_items = 6
                rng5 = np.random.default_rng(55)
                item_x   = rng5.uniform(0.05, 0.90, n_items)
                item_y   = rng5.uniform(0.05, 0.90, n_items)
                item_sym = [symbols[i % len(symbols)] for i in range(n_items)]
                item_sz  = rng5.integers(24, 52, n_items)
                # Each emoji appears for ~1s every 3s (staggered)
                item_phase = rng5.uniform(0, 3.0, n_items)

                def emoji_filter(get_frame, t):
                    from PIL import Image as PILImage, ImageDraw, ImageFont
                    import cv2 as _cv2
                    frame = get_frame(t)
                    h, w = frame.shape[:2]
                    pil_img = PILImage.fromarray(frame)
                    draw = ImageDraw.Draw(pil_img)
                    for i in range(n_items):
                        # Appear for 0.8s every 3s with staggered phase
                        cycle = (t + item_phase[i]) % 3.0
                        if cycle > 0.8:
                            continue
                        # Fade alpha: in for first 0.2s, out for last 0.2s
                        if cycle < 0.2:
                            alpha = cycle / 0.2
                        elif cycle > 0.6:
                            alpha = (0.8 - cycle) / 0.2
                        else:
                            alpha = 1.0
                        # Slight drift per frame for uniqueness
                        drift = 0.02 * np.sin(t * 3 + i)
                        px = int((item_x[i] + drift) * w)
                        py = int(item_y[i] * h)
                        try:
                            try:
                                font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
                                                          int(item_sz[i]))
                            except Exception:
                                font = ImageFont.load_default()
                            # Draw with alpha via temp layer
                            layer = PILImage.new("RGBA", pil_img.size, (0, 0, 0, 0))
                            ld = ImageDraw.Draw(layer)
                            ld.text((px, py), item_sym[i], font=font,
                                    embedded_color=True)
                            # Blend at alpha
                            base = pil_img.convert("RGBA")
                            layer_a = layer.split()[3]
                            layer_a = layer_a.point(lambda v: int(v * alpha))
                            layer.putalpha(layer_a)
                            pil_img = PILImage.alpha_composite(base, layer).convert("RGB")
                            draw = ImageDraw.Draw(pil_img)
                        except Exception:
                            pass  # silently skip if font unavailable
                    return np.array(pil_img)
                clip = clip.transform(emoji_filter)

        return clip

    # ── Audio ────────────────────────────────────────────────────────────────

    def build_music_track(self, duration: float, music_path: str | None,
                           volume_style: str = "buildup") -> object | None:
        """Return an AudioClip with dynamic volume matching the style."""
        from moviepy import AudioFileClip, afx
        import numpy as np

        if not music_path or not os.path.exists(music_path):
            return None

        try:
            music = AudioFileClip(music_path)
        except Exception as e:
            self.log(f"⚠️  Could not load music: {e}")
            return None

        # Loop or trim to match video duration
        if music.duration < duration:
            from moviepy import afx as _afx
            loops = int(duration / music.duration) + 1
            from moviepy import concatenate_audioclips
            music = concatenate_audioclips([music] * loops)

        music = music.subclipped(0, duration)

        # Apply dynamic volume curve
        if volume_style == "buildup":
            # Quiet start → loud climax → pump down → BOOM at 80%
            def vol_curve(t):
                prog = t / duration
                if prog < 0.3:
                    return 0.15 + 0.5 * (prog / 0.3)
                elif prog < 0.7:
                    return 0.65 + 0.35 * ((prog - 0.3) / 0.4)
                elif prog < 0.8:
                    return 1.0
                else:
                    return 1.0
            music = music.with_effects([afx.MultiplyVolume(0.7)])

        elif volume_style == "drop":
            # Normal → dip quiet → EXPLOSION
            def make_vol(dur):
                def vol_curve(t):
                    prog = t / dur
                    if prog < 0.5:
                        return 0.8
                    elif prog < 0.65:
                        return 0.8 - 0.7 * ((prog - 0.5) / 0.15)   # drop
                    elif prog < 0.7:
                        return 0.1
                    else:
                        return 1.0   # EXPLOSION
                return vol_curve
            music = music.with_volume_scaled(0.8)

        elif volume_style == "steady":
            music = music.with_effects([afx.MultiplyVolume(0.65)])

        return music

    # ── Main Pipeline ────────────────────────────────────────────────────────

    def process_video(self, video_path: str, config: dict,
                       progress_fn=None, log_fn=None) -> list[str]:
        """
        Full pipeline. Returns list of output file paths.
        config keys: effects, music_path, volume_style, sensitivity,
                     crop_vertical, fade, max_clips
        """
        from moviepy import VideoFileClip, CompositeVideoClip, afx, vfx
        from moviepy import concatenate_videoclips

        log   = log_fn or self.log
        prog  = progress_fn or (lambda p, s: None)
        outs  = []

        log(f"\n🎬 Processing: {Path(video_path).name}")
        prog(5, "Detecting highlight moments…")

        moments = self.detect_moments(video_path, config.get("sensitivity", "medium"))
        max_clips = config.get("max_clips", 10)
        # Sort by score and take best N
        moments = sorted(moments, key=lambda x: -x["score"])[:max_clips]
        moments = sorted(moments, key=lambda x: x["start"])   # restore time order

        log(f"📋 Processing {len(moments)} clip(s)")

        vid = VideoFileClip(video_path)
        effects  = config.get("effects", [])
        music_p  = config.get("music_path")
        vol_sty  = config.get("volume_style", "buildup")
        crop     = config.get("crop_vertical", True)
        add_fade = config.get("fade", True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = Path(video_path).stem

        for idx, moment in enumerate(moments):
            pct = 10 + int(80 * idx / len(moments))
            log(f"\n✂️  Clip {idx+1}/{len(moments)}: {moment['start']:.1f}s → {moment['end']:.1f}s")
            prog(pct, f"Processing clip {idx+1}/{len(moments)}…")

            try:
                clip = vid.subclipped(moment["start"], moment["end"])

                # Apply effects
                if effects:
                    log(f"   🎨 Applying effects: {', '.join(effects)}")
                    fx_list = effects.copy()
                    if crop and "crop_vertical" not in fx_list:
                        fx_list.append("crop_vertical")
                    clip = self.apply_effects(clip, fx_list, moment["score"])
                elif crop:
                    clip = self.apply_effects(clip, ["crop_vertical"], moment["score"])

                # Fade in/out
                if add_fade:
                    clip = clip.with_effects([vfx.FadeIn(0.4), vfx.FadeOut(0.4)])

                # Music
                music = self.build_music_track(clip.duration, music_p, vol_sty)
                if music:
                    log("   🎵 Adding music track")
                    # Duck original audio, layer music
                    if clip.audio:
                        orig = clip.audio.with_effects([afx.MultiplyVolume(0.3)])
                        from moviepy import CompositeAudioClip
                        combined = CompositeAudioClip([orig, music])
                        clip = clip.with_audio(combined)
                    else:
                        clip = clip.with_audio(music)

                # Output filename
                out_name = f"{base_name}_short_{idx+1:02d}_{timestamp}.mp4"
                out_path = str(OUTPUT_DIR / out_name)

                log(f"   💾 Exporting → {out_name}")
                clip.write_videofile(
                    out_path,
                    codec="libx264",
                    audio_codec="aac",
                    fps=30,
                    preset="fast",
                    logger=None
                )
                outs.append(out_path)
                log(f"   ✅ Saved!")

            except Exception as e:
                log(f"   ❌ Error on clip {idx+1}: {e}")
                import traceback
                log(traceback.format_exc())

        vid.close()
        prog(100, "Done! ✅")
        log(f"\n🏆 {len(outs)} short(s) saved to: {OUTPUT_DIR}")
        return outs


# ─────────────────────────────────────────────────────────────────────────────
#  GUI
# ─────────────────────────────────────────────────────────────────────────────

class App(tk.Tk):

    EFFECTS_MAP = {
        "🎨 Grayscale":    "grayscale",
        "🔍 Zoom Punch":   "zoom_punch",
        "🌑 Vignette":     "vignette",
        "🐢 Slow Motion":  "slow_motion",
        "⚡ Color Boost":  "color_boost",
        "🔆 Contrast":     "contrast",
        "⚡ Flash Cut":    "flash_cut",
        # ── Copyright-defeat overlays ──
        "❄️  Winter Snow":  "winter_snow",
        "📺 Film Grain":    "film_grain",
        "🔥 Fire Sparks":   "fire_sparks",
        "✨ Emoji Burst":   "emoji_burst",
        "🌧️  Rain Drops":   "rain_drops",
    }

    VOL_STYLES = {
        "📈 Build-Up (gets louder → peak)":      "buildup",
        "💥 Drop (quiet then EXPLOSION)":         "drop",
        "🔊 Steady (consistent volume)":          "steady",
    }

    SENSITIVITY = {
        "Low  – only biggest moments":  "low",
        "Medium – balanced":            "medium",
        "High – catch everything":      "high",
    }

    def __init__(self):
        super().__init__()

        self.title("⚽ Football Viral Shorts Generator")
        self.configure(bg=BG)
        self.geometry("920x880")
        self.minsize(820, 800)

        self.video_files  = []   # list of paths
        self.music_path   = tk.StringVar()
        self.processing   = False

        self._build_ui()
        self._apply_style()

    # ── UI Construction ──────────────────────────────────────────────────────

    def _build_ui(self):
        # ── Header ──
        hdr = tk.Frame(self, bg=BG, pady=16)
        hdr.pack(fill="x", padx=24)

        tk.Label(hdr, text="⚽", font=("Helvetica", 36), bg=BG, fg=ACCENT2).pack(side="left")
        title_f = tk.Frame(hdr, bg=BG)
        title_f.pack(side="left", padx=12)
        tk.Label(title_f, text="FOOTBALL VIRAL SHORTS", font=("Helvetica", 22, "bold"),
                 bg=BG, fg=TEXT).pack(anchor="w")
        tk.Label(title_f, text="Auto-detect • Effects • Music • Export",
                 font=("Helvetica", 10), bg=BG, fg=TEXT_DIM).pack(anchor="w")

        # Output badge
        out_f = tk.Frame(hdr, bg=CARD, padx=10, pady=6)
        out_f.pack(side="right")
        tk.Label(out_f, text="OUTPUT", font=("Helvetica", 8, "bold"),
                 bg=CARD, fg=TEXT_DIM).pack()
        tk.Label(out_f, text=str(OUTPUT_DIR), font=("Helvetica", 8),
                 bg=CARD, fg=ACCENT, wraplength=300).pack()

        # ── Divider ──
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x", padx=24)

        # ── Main content (left + right panels) ──
        main = tk.Frame(self, bg=BG)
        main.pack(fill="both", expand=True, padx=24, pady=12)

        left  = tk.Frame(main, bg=BG)
        right = tk.Frame(main, bg=BG)
        left.pack(side="left", fill="both", expand=True, padx=(0, 8))
        right.pack(side="right", fill="both", expand=True, padx=(8, 0))

        # ── LEFT: Video + Music ──
        self._section(left, "📁 VIDEO FILES")
        vid_frame = self._card(left)

        vid_btns = tk.Frame(vid_frame, bg=CARD)
        vid_btns.pack(fill="x", pady=(0, 6))
        self._btn(vid_btns, "＋ Add Videos", self._add_videos, ACCENT, "left")
        self._btn(vid_btns, "✕ Clear", self._clear_videos, "#555", "left")

        # File list
        list_frame = tk.Frame(vid_frame, bg=BG3, relief="flat")
        list_frame.pack(fill="both", expand=True)
        self.file_listbox = tk.Listbox(
            list_frame, bg=BG3, fg=TEXT, selectbackground=ACCENT,
            selectforeground=BG, font=("Helvetica", 9),
            relief="flat", bd=0, highlightthickness=0, height=6
        )
        sb = ttk.Scrollbar(list_frame, orient="vertical",
                           command=self.file_listbox.yview)
        self.file_listbox.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        self.file_listbox.pack(fill="both", expand=True, padx=4, pady=4)

        self.file_count_lbl = tk.Label(vid_frame, text="No videos added",
                                       font=("Helvetica", 8), bg=CARD, fg=TEXT_DIM)
        self.file_count_lbl.pack(anchor="w", pady=(4, 0))

        # Music
        self._section(left, "🎵 BACKGROUND MUSIC")
        mus_frame = self._card(left)
        mus_row = tk.Frame(mus_frame, bg=CARD)
        mus_row.pack(fill="x")
        self._btn(mus_row, "Browse Music…", self._browse_music, ACCENT2, "left")
        self.music_lbl = tk.Label(mus_row, text="No file selected",
                                  font=("Helvetica", 9), bg=CARD, fg=TEXT_DIM,
                                  wraplength=200, justify="left")
        self.music_lbl.pack(side="left", padx=8)

        tk.Label(mus_frame, text="Supports MP3, WAV, OGG, M4A",
                 font=("Helvetica", 8), bg=CARD, fg=TEXT_DIM).pack(anchor="w", pady=(4, 0))

        # Volume style
        self._section(left, "🔊 VOLUME STYLE")
        vol_card = self._card(left)
        self.vol_var = tk.StringVar(value=list(self.VOL_STYLES.keys())[0])
        for label in self.VOL_STYLES:
            rb = tk.Radiobutton(
                vol_card, text=label, variable=self.vol_var, value=label,
                bg=CARD, fg=TEXT, selectcolor=BG3,
                activebackground=CARD, activeforeground=ACCENT,
                font=("Helvetica", 9), indicatoron=True
            )
            rb.pack(anchor="w", pady=1)

        # ── RIGHT: Effects + Settings ──
        self._section(right, "🎨 VISUAL EFFECTS")
        fx_card = self._card(right)
        self.fx_vars = {}

        # Standard effects group
        STANDARD_FX = ["grayscale", "zoom_punch", "vignette", "slow_motion",
                        "color_boost", "contrast", "flash_cut"]
        OVERLAY_FX  = ["winter_snow", "film_grain", "fire_sparks", "emoji_burst", "rain_drops"]

        for label, key in self.EFFECTS_MAP.items():
            if key not in STANDARD_FX:
                continue
            var = tk.BooleanVar(value=key in ["zoom_punch", "vignette", "color_boost", "flash_cut"])
            cb = tk.Checkbutton(
                fx_card, text=label, variable=var,
                bg=CARD, fg=TEXT, selectcolor=BG3,
                activebackground=CARD, activeforeground=ACCENT,
                font=("Helvetica", 9)
            )
            cb.pack(anchor="w", pady=1)
            self.fx_vars[key] = var

        # Separator + copyright-defeat overlay group
        tk.Frame(fx_card, bg=BORDER, height=1).pack(fill="x", pady=(6, 2))
        tk.Label(fx_card, text="🛡️  COPYRIGHT-DEFEAT OVERLAYS",
                 font=("Helvetica", 8, "bold"), bg=CARD, fg=ACCENT2).pack(anchor="w")
        tk.Label(fx_card, text="Add unique visual noise to bypass Content ID",
                 font=("Helvetica", 7), bg=CARD, fg=TEXT_DIM).pack(anchor="w", pady=(0, 3))

        for label, key in self.EFFECTS_MAP.items():
            if key not in OVERLAY_FX:
                continue
            var = tk.BooleanVar(value=key in ["film_grain", "winter_snow"])
            cb = tk.Checkbutton(
                fx_card, text=label, variable=var,
                bg=CARD, fg=ACCENT, selectcolor=BG3,
                activebackground=CARD, activeforeground=ACCENT2,
                font=("Helvetica", 9)
            )
            cb.pack(anchor="w", pady=1)
            self.fx_vars[key] = var

        # Crop option
        self.crop_var = tk.BooleanVar(value=True)
        tk.Checkbutton(fx_card, text="📱 Crop to 9:16 (Reels/Shorts)",
                       variable=self.crop_var, bg=CARD, fg=YELLOW,
                       selectcolor=BG3, activebackground=CARD,
                       font=("Helvetica", 9, "bold")).pack(anchor="w", pady=(6, 1))

        self.fade_var = tk.BooleanVar(value=True)
        tk.Checkbutton(fx_card, text="🌅 Fade In / Fade Out",
                       variable=self.fade_var, bg=CARD, fg=TEXT,
                       selectcolor=BG3, activebackground=CARD,
                       font=("Helvetica", 9)).pack(anchor="w", pady=1)

        # Settings
        self._section(right, "⚙️  SETTINGS")
        set_card = self._card(right)

        # Sensitivity
        tk.Label(set_card, text="Detection Sensitivity:",
                 font=("Helvetica", 9, "bold"), bg=CARD, fg=TEXT).pack(anchor="w")
        self.sens_var = tk.StringVar(value=list(self.SENSITIVITY.keys())[1])
        sens_menu = ttk.Combobox(set_card, textvariable=self.sens_var,
                                 values=list(self.SENSITIVITY.keys()),
                                 state="readonly", width=34)
        sens_menu.pack(anchor="w", pady=(2, 8))

        # Max clips
        tk.Label(set_card, text="Max Clips per Video:",
                 font=("Helvetica", 9, "bold"), bg=CARD, fg=TEXT).pack(anchor="w")
        self.max_clips_var = tk.IntVar(value=5)
        clip_frame = tk.Frame(set_card, bg=CARD)
        clip_frame.pack(anchor="w", pady=(2, 0))
        self.clips_slider = tk.Scale(
            clip_frame, variable=self.max_clips_var,
            from_=1, to=15, orient="horizontal", length=180,
            bg=CARD, fg=TEXT, troughcolor=BG3,
            highlightthickness=0, sliderrelief="flat"
        )
        self.clips_slider.pack(side="left")
        self.clips_count_lbl = tk.Label(clip_frame, textvariable=self.max_clips_var,
                                        font=("Helvetica", 12, "bold"),
                                        bg=CARD, fg=ACCENT, width=3)
        self.clips_count_lbl.pack(side="left", padx=6)

        # ── Log Panel ──
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x", padx=24)
        log_hdr = tk.Frame(self, bg=BG)
        log_hdr.pack(fill="x", padx=24, pady=(8, 0))
        tk.Label(log_hdr, text="📋 LOG", font=("Helvetica", 9, "bold"),
                 bg=BG, fg=TEXT_DIM).pack(side="left")
        self._btn(log_hdr, "Clear Log", self._clear_log, "#333", "right", small=True)

        log_frame = tk.Frame(self, bg=BG3)
        log_frame.pack(fill="x", padx=24, pady=(4, 0))
        self.log_text = tk.Text(
            log_frame, height=6, bg=BG3, fg=GREEN,
            font=("Courier", 8), relief="flat", bd=0,
            highlightthickness=0, state="disabled", wrap="word"
        )
        log_sb = ttk.Scrollbar(log_frame, orient="vertical",
                               command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=log_sb.set)
        log_sb.pack(side="right", fill="y")
        self.log_text.pack(fill="both", padx=6, pady=4)

        # ── Progress Bar ──
        self.progress_var = tk.DoubleVar(value=0)
        self.progress_lbl = tk.Label(self, text="Ready", font=("Helvetica", 9),
                                     bg=BG, fg=TEXT_DIM)
        self.progress_lbl.pack(padx=24, anchor="w")
        self.progress_bar = ttk.Progressbar(
            self, variable=self.progress_var,
            maximum=100, length=400, mode="determinate"
        )
        self.progress_bar.pack(fill="x", padx=24, pady=(2, 6))

        # ── GO Button ──
        self.go_btn = tk.Button(
            self, text="⚡  GENERATE VIRAL SHORTS  ⚡",
            font=("Helvetica", 14, "bold"), bg=ACCENT2, fg="white",
            activebackground="#e55a24", activeforeground="white",
            relief="flat", pady=14, cursor="hand2",
            command=self._start_processing
        )
        self.go_btn.pack(fill="x", padx=24, pady=(0, 16))

        self._log("Welcome! Add videos, choose music & effects, then hit GO. 🚀")
        self._log(f"Shorts will be saved to: {OUTPUT_DIR}")

    def _section(self, parent, title):
        lbl = tk.Label(parent, text=title, font=("Helvetica", 9, "bold"),
                       bg=BG, fg=TEXT_DIM, anchor="w")
        lbl.pack(fill="x", pady=(10, 2))

    def _card(self, parent):
        f = tk.Frame(parent, bg=CARD, padx=12, pady=10, relief="flat")
        f.pack(fill="x")
        return f

    def _btn(self, parent, text, cmd, color, side, small=False):
        size = 8 if small else 9
        b = tk.Button(parent, text=text, command=cmd,
                      bg=color, fg="white", font=("Helvetica", size, "bold"),
                      relief="flat", padx=10, pady=4, cursor="hand2",
                      activebackground=color, activeforeground="white")
        b.pack(side=side, padx=(0, 4))
        return b

    def _apply_style(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Horizontal.TProgressbar",
                        troughcolor=BG3, background=ACCENT,
                        bordercolor=BG, lightcolor=ACCENT, darkcolor=ACCENT)
        style.configure("TCombobox", fieldbackground=BG3, background=BG3,
                        foreground=TEXT, selectbackground=ACCENT)
        style.configure("Vertical.TScrollbar",
                        troughcolor=BG3, background=BORDER,
                        arrowcolor=TEXT_DIM, bordercolor=BG)

    # ── Actions ─────────────────────────────────────────────────────────────

    def _add_videos(self):
        files = filedialog.askopenfilenames(
            title="Select Football Highlight Videos",
            filetypes=[
                ("Video files", "*.mp4 *.mov *.avi *.mkv *.webm *.m4v"),
                ("All files", "*.*"),
            ]
        )
        for f in files:
            if f not in self.video_files:
                self.video_files.append(f)
                self.file_listbox.insert("end", f"  {Path(f).name}")
        n = len(self.video_files)
        self.file_count_lbl.config(text=f"{n} video(s) added" if n else "No videos added")

    def _clear_videos(self):
        self.video_files.clear()
        self.file_listbox.delete(0, "end")
        self.file_count_lbl.config(text="No videos added")

    def _browse_music(self):
        f = filedialog.askopenfilename(
            title="Select Music File",
            filetypes=[
                ("Audio files", "*.mp3 *.wav *.ogg *.m4a *.aac *.flac"),
                ("All files", "*.*"),
            ]
        )
        if f:
            self.music_path.set(f)
            self.music_lbl.config(text=Path(f).name, fg=ACCENT)

    def _clear_log(self):
        self.log_text.config(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.config(state="disabled")

    def _log(self, msg: str):
        def _do():
            self.log_text.config(state="normal")
            self.log_text.insert("end", msg + "\n")
            self.log_text.see("end")
            self.log_text.config(state="disabled")
        self.after(0, _do)

    def _set_progress(self, pct: float, status: str):
        def _do():
            self.progress_var.set(pct)
            self.progress_lbl.config(text=status)
        self.after(0, _do)

    # ── Processing ───────────────────────────────────────────────────────────

    def _start_processing(self):
        if self.processing:
            return
        if not self.video_files:
            messagebox.showwarning("No Videos", "Please add at least one video file.")
            return

        # Build config
        effects = [k for k, v in self.fx_vars.items() if v.get()]
        sens_key = self.sens_var.get()
        vol_key  = self.vol_var.get()

        config = {
            "effects":       effects,
            "music_path":    self.music_path.get() or None,
            "volume_style":  self.VOL_STYLES.get(vol_key, "buildup"),
            "sensitivity":   self.SENSITIVITY.get(sens_key, "medium"),
            "crop_vertical": self.crop_var.get(),
            "fade":          self.fade_var.get(),
            "max_clips":     self.max_clips_var.get(),
        }

        self.processing = True
        self.go_btn.config(state="disabled", text="⏳  Processing…  Please wait…", bg="#444")
        self._log("\n" + "═" * 50)
        self._log("🚀 Starting processing pipeline…")

        threading.Thread(target=self._run_pipeline, args=(config,), daemon=True).start()

    def _run_pipeline(self, config: dict):
        processor = VideoProcessor(log_fn=self._log)
        all_outputs = []

        for i, vf in enumerate(self.video_files):
            self._log(f"\n📽️  Video {i+1}/{len(self.video_files)}: {Path(vf).name}")
            try:
                outs = processor.process_video(
                    vf, config,
                    progress_fn=self._set_progress,
                    log_fn=self._log
                )
                all_outputs.extend(outs)
            except Exception as e:
                self._log(f"❌ Failed: {e}")
                import traceback
                self._log(traceback.format_exc())

        self.processing = False
        self.after(0, self._on_done, all_outputs)

    def _on_done(self, outputs: list[str]):
        self.go_btn.config(
            state="normal",
            text="⚡  GENERATE VIRAL SHORTS  ⚡",
            bg=ACCENT2
        )
        self._set_progress(100, f"✅ Done! {len(outputs)} short(s) exported.")
        self._log("\n" + "═" * 50)
        self._log(f"🏆 DONE! {len(outputs)} viral short(s) saved to:")
        self._log(f"   {OUTPUT_DIR}")
        self._log("Upload to Instagram Reels, YouTube Shorts, or Facebook! 🔥")

        if outputs:
            ans = messagebox.askyesno(
                "Done! 🎉",
                f"{len(outputs)} short(s) exported to your Desktop.\n\n"
                f"{OUTPUT_DIR}\n\nOpen folder now?"
            )
            if ans:
                self._open_output_folder()

    def _open_output_folder(self):
        import platform
        path = str(OUTPUT_DIR)
        if platform.system() == "Windows":
            os.startfile(path)
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = App()
    app.mainloop()
