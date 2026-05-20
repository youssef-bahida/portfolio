import os
import subprocess
import threading
import tkinter as tk
from tkinter import filedialog, ttk, messagebox
from tkinter import font as tkfont

# =========================================
# QUALITY OPTIONS
# =========================================
QUALITY_OPTIONS = {
    "240p  — Tiny":    240,
    "320p  — Small":   320,
    "480p  — SD":      480,
    "720p  — HD":      720,
    "1080p — Full HD": 1080,
}

# =========================================
# COLOR PALETTE
# =========================================
BG        = "#0F1117"
SURFACE   = "#1A1D27"
CARD      = "#22263A"
ACCENT    = "#6C63FF"
ACCENT2   = "#FF6B6B"
GREEN     = "#43E97B"
TEXT      = "#EAEAEA"
SUBTEXT   = "#8B8FA8"
BORDER    = "#2E3250"

# =========================================
# APP STATE
# =========================================
selected_files   = []
conversion_active = False

# =========================================
# ROOT WINDOW
# =========================================
root = tk.Tk()
root.title("VideoForge · Batch Converter")
root.geometry("520x600")
root.resizable(False, False)
root.configure(bg=BG)

# Center window on screen
root.update_idletasks()
x = (root.winfo_screenwidth()  - 520) // 2
y = (root.winfo_screenheight() - 600) // 2
root.geometry(f"520x600+{x}+{y}")

# =========================================
# FONTS
# =========================================
FONT_TITLE   = ("Georgia", 20, "bold")
FONT_SUB     = ("Georgia", 10, "italic")
FONT_LABEL   = ("Courier", 10, "bold")
FONT_SMALL   = ("Courier", 9)
FONT_BTN     = ("Courier", 11, "bold")
FONT_COUNT   = ("Courier", 13, "bold")

# =========================================
# HELPERS: rounded rectangle on Canvas
# =========================================
def round_rect(canvas, x1, y1, x2, y2, r=16, **kwargs):
    points = [
        x1+r, y1,  x2-r, y1,
        x2,   y1,  x2,   y1+r,
        x2,   y2-r,x2,   y2,
        x2-r, y2,  x1+r, y2,
        x1,   y2,  x1,   y2-r,
        x1,   y1+r,x1,   y1,
    ]
    return canvas.create_polygon(points, smooth=True, **kwargs)

# =========================================
# HEADER
# =========================================
header_frame = tk.Frame(root, bg=BG)
header_frame.pack(fill="x", padx=0, pady=(28, 0))

tk.Label(
    header_frame,
    text="VideoForge",
    font=FONT_TITLE,
    bg=BG, fg=TEXT
).pack()

tk.Label(
    header_frame,
    text="Batch quality converter · powered by ffmpeg",
    font=FONT_SUB,
    bg=BG, fg=SUBTEXT
).pack(pady=(2, 0))

# Decorative separator
sep = tk.Canvas(root, height=2, bg=BG, highlightthickness=0)
sep.pack(fill="x", padx=40, pady=12)
sep.create_line(0, 1, 440, 1, fill=BORDER, width=2)

# =========================================
# DROP ZONE CARD
# =========================================
drop_canvas = tk.Canvas(
    root, width=440, height=110,
    bg=SURFACE, highlightthickness=0
)
drop_canvas.pack(padx=40, pady=(4, 0))

def draw_drop_zone(label="Click to choose videos", count=0):
    drop_canvas.delete("all")
    # Dashed border simulation via rounded rect
    round_rect(drop_canvas, 4, 4, 436, 106, r=14,
               fill=CARD, outline=ACCENT, width=2)
    # Icon
    drop_canvas.create_text(
        220, 38,
        text="⬆",
        font=("Courier", 22, "bold"),
        fill=ACCENT
    )
    drop_canvas.create_text(
        220, 68,
        text=label,
        font=FONT_LABEL,
        fill=TEXT
    )
    if count:
        drop_canvas.create_text(
            220, 88,
            text=f"{count} file{'s' if count != 1 else ''} ready",
            font=FONT_SMALL,
            fill=GREEN
        )

draw_drop_zone()

def choose_files():
    global selected_files
    files = filedialog.askopenfilenames(
        title="Choose Videos",
        filetypes=[("Video Files", "*.mp4 *.mov *.avi *.mkv *.webm")]
    )
    if files:
        selected_files = list(files)
        names = ", ".join(os.path.basename(f) for f in selected_files[:2])
        if len(selected_files) > 2:
            names += f" +{len(selected_files)-2} more"
        draw_drop_zone(label=names, count=len(selected_files))
        update_start_btn()

drop_canvas.bind("<Button-1>", lambda e: choose_files())
drop_canvas.bind("<Enter>", lambda e: drop_canvas.configure(cursor="hand2"))
drop_canvas.bind("<Leave>", lambda e: drop_canvas.configure(cursor=""))

# =========================================
# QUALITY SELECTOR
# =========================================
quality_frame = tk.Frame(root, bg=BG)
quality_frame.pack(padx=40, pady=(16, 0), fill="x")

tk.Label(
    quality_frame,
    text="OUTPUT QUALITY",
    font=FONT_LABEL,
    bg=BG, fg=SUBTEXT
).pack(anchor="w")

selected_quality = tk.StringVar(value="720p  — HD")

style = ttk.Style()
style.theme_use("clam")
style.configure(
    "Dark.TCombobox",
    fieldbackground=CARD,
    background=CARD,
    foreground=TEXT,
    selectbackground=ACCENT,
    selectforeground=TEXT,
    bordercolor=BORDER,
    arrowcolor=ACCENT,
    lightcolor=CARD,
    darkcolor=CARD,
    relief="flat",
    padding=6,
)
style.map(
    "Dark.TCombobox",
    fieldbackground=[("readonly", CARD)],
    foreground=[("readonly", TEXT)],
)

quality_menu = ttk.Combobox(
    quality_frame,
    textvariable=selected_quality,
    values=list(QUALITY_OPTIONS.keys()),
    state="readonly",
    style="Dark.TCombobox",
    font=FONT_SMALL,
    width=28
)
quality_menu.pack(anchor="w", pady=(4, 0))

# =========================================
# PROGRESS SECTION
# =========================================
prog_frame = tk.Frame(root, bg=BG)
prog_frame.pack(padx=40, pady=(18, 0), fill="x")

prog_header = tk.Frame(prog_frame, bg=BG)
prog_header.pack(fill="x")

status_label = tk.Label(
    prog_header,
    text="Ready",
    font=FONT_SMALL,
    bg=BG, fg=SUBTEXT,
    anchor="w"
)
status_label.pack(side="left")

pct_label = tk.Label(
    prog_header,
    text="",
    font=FONT_SMALL,
    bg=BG, fg=ACCENT,
    anchor="e"
)
pct_label.pack(side="right")

style.configure(
    "Accent.Horizontal.TProgressbar",
    troughcolor=CARD,
    background=ACCENT,
    bordercolor=CARD,
    lightcolor=ACCENT,
    darkcolor=ACCENT,
    thickness=10,
)

progress = ttk.Progressbar(
    prog_frame,
    orient="horizontal",
    length=440,
    mode="determinate",
    style="Accent.Horizontal.TProgressbar"
)
progress.pack(pady=(6, 0))

# =========================================
# START BUTTON
# =========================================
btn_frame = tk.Frame(root, bg=BG)
btn_frame.pack(pady=(20, 0))

start_canvas = tk.Canvas(
    btn_frame, width=260, height=50,
    bg=BG, highlightthickness=0
)
start_canvas.pack()

def draw_start_btn(active=True, running=False):
    start_canvas.delete("all")
    color  = ACCENT  if active and not running else BORDER
    label  = "⏳  Converting…" if running else "▶  Start Conversion"
    cursor = "hand2" if active and not running else "arrow"
    round_rect(start_canvas, 0, 0, 260, 50, r=12,
               fill=color, outline="")
    start_canvas.create_text(
        130, 25,
        text=label,
        font=FONT_BTN,
        fill=TEXT if active else SUBTEXT
    )
    start_canvas.configure(cursor=cursor)

draw_start_btn(active=False)

def update_start_btn():
    draw_start_btn(active=bool(selected_files), running=False)

# =========================================
# CONVERSION LOGIC (in a thread)
# =========================================
def run_conversion():
    global conversion_active
    conversion_active = True
    draw_start_btn(running=True)

    quality_name   = selected_quality.get()
    quality_height = QUALITY_OPTIONS[quality_name]
    total          = len(selected_files)
    progress.configure(maximum=total)

    for index, input_video in enumerate(selected_files):
        filename = os.path.basename(input_video)
        name, _  = os.path.splitext(filename)
        tag      = quality_name.split()[0]
        output_video = os.path.join(
            os.path.dirname(input_video),
            f"{name}_{tag}.mp4"
        )

        status_label.config(text=f"↻  {filename}")
        pct_label.config(text=f"{index}/{total}")
        root.update()

        command = [
            "ffmpeg", "-y",
            "-i", input_video,
            "-vf", f"scale=-2:{quality_height}",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "28",
            "-c:a", "aac",
            output_video
        ]
        subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        progress["value"] = index + 1
        root.update()

    status_label.config(text="✔  All done!")
    pct_label.config(text=f"{total}/{total}")
    conversion_active = False
    draw_start_btn(active=True)
    messagebox.showinfo("VideoForge", f"✅  {total} video(s) converted successfully!")

def start_conversion():
    if conversion_active:
        return
    if not selected_files:
        messagebox.showerror("VideoForge", "Please select at least one video first.")
        return
    t = threading.Thread(target=run_conversion, daemon=True)
    t.start()

start_canvas.bind("<Button-1>", lambda e: start_conversion())

# =========================================
# FOOTER
# =========================================
tk.Label(
    root,
    text="outputs are saved next to source files",
    font=("Courier", 8),
    bg=BG, fg=BORDER
).pack(side="bottom", pady=10)

# =========================================
# RUN
# =========================================
root.mainloop()
