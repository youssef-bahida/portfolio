# 🎬 Social Media Auto-Publisher — n8n Workflow

Automatically uploads videos from Google Drive to **YouTube**, **Instagram Reels**, and **Facebook**, then cleans up after itself. Set it and forget it.

---

## 📋 Overview

This n8n workflow watches a Google Drive folder for new videos and publishes them across three platforms on a schedule — with staggered timing to avoid API rate limits and platform spam filters.

```
Google Drive → Download → YouTube Upload
                        → Cloudinary → Instagram Reels
                                     → Facebook Video
                        → Cleanup (Drive + Cloudinary)
```

---

## 🔄 Workflow Steps

| Step | Node | Description |
|------|------|-------------|
| 1 | Schedule Trigger | Fires on a defined interval |
| 2 | Search files and folders | Lists up to 5 videos from the target Drive folder |
| 3 | Loop Over Items | Iterates over each video file |
| 4 | Download file | Downloads the video binary from Drive |
| 5 | Wait (before YouTube) | Buffer before YouTube upload |
| 6 | Upload a video | Publishes to YouTube (public) |
| 7 | Add a playlist item | Adds the video to a target YouTube playlist |
| 8 | Upload an asset (Cloudinary) | Uploads video to Cloudinary for URL-based sharing |
| 9 | Wait (before Facebook) | Buffer before Facebook post |
| 10 | HTTP Request | Posts video to Facebook Page via Graph API |
| 11 | Wait (before Instagram) | Buffer before Instagram publish |
| 12 | Publish | Posts as an Instagram Reel |
| 13 | Wait (before cleanup) | Buffer before Cloudinary cleanup |
| 14 | HTTP Request | Deletes video asset from Cloudinary |
| 15 | Delete a file | Permanently deletes video from Google Drive |
| 16 | Wait (between videos) | Pause between processing each video |

---

## ⚙️ Configuration

Before activating the workflow, update the following placeholders in each node:

### Google Drive
- **Source Folder ID** — the ID of your video upload folder
- **Batch size** — number of videos to process per run (default: 5)
- Post-upload, files are **permanently deleted** from Drive

### YouTube
- **Playlist ID** — ID of the playlist to add uploaded videos to
- **Region code** — your target region (e.g. `US`, `MA`, etc.)
- **Category ID** — YouTube category for your content
- **Privacy status** — `public`, `private`, or `unlisted`
- **Tags** — comma-separated tags for discoverability

### Cloudinary
- **Cloud name** — your Cloudinary cloud name (in the HTTP DELETE URL)
- Used to host a temporary video URL for Instagram & Facebook
- Video is deleted from Cloudinary after publishing

### Instagram
- **Account Node ID** — your Instagram Business account node ID
- **Caption** — your default Reels caption / hashtags

### Facebook
- **Page ID** — your Facebook Page ID (in the Graph API URL)
- **Access Token** — store this in an n8n credential, not plaintext

---

## 🔐 Required Credentials

| Service | Credential Type | Used For |
|---------|----------------|----------|
| Google Drive | OAuth2 | List, download, and delete files |
| YouTube | OAuth2 | Upload videos and manage playlists |
| Instagram | Instagram API | Publish Reels |
| Cloudinary | Cloudinary API | Host video URL temporarily |
| Facebook | HTTP Basic / Bearer Token | Post to Facebook Page |

> ⚠️ **Security note:** Never hardcode access tokens directly in HTTP Request nodes. Use n8n credentials or environment variables (e.g. `{{ $env.FB_ACCESS_TOKEN }}`) to keep secrets out of your workflow JSON.

---

## 🚀 Setup

1. Import `Vid_Upload_Youtube.json` into your n8n instance.
2. Connect all credentials listed above.
3. Update the Google Drive folder ID to your upload folder.
4. Set your YouTube playlist ID, category, region, and tags.
5. Set your Facebook Page ID and move the access token to a credential.
6. Set your Instagram account node ID.
7. Update the Cloudinary cloud name in the HTTP DELETE request URL.
8. Activate the workflow.

---

## ⏱️ Timing Overview

```
Download
  ├── Wait → YouTube Upload → Add to Playlist → Delete Drive file → Wait → Loop
  └── Cloudinary Upload
        ├── Wait → Facebook Post
        ├── Wait → Instagram Reels
        └── Wait → Delete from Cloudinary
```

All wait durations are configurable inside each Wait node.

---

## 📁 Project Structure

```
Vid_Upload_Youtube.json   # n8n workflow export
README.md                 # This file
```

---

## 📌 Notes

- Videos are processed **one at a time** with a configurable gap between each to avoid throttling.
- After publishing, videos are **permanently deleted** from both Google Drive and Cloudinary — keep backups elsewhere if needed.
- The Loop Over Items node ensures each video is fully processed before moving to the next.

---

## 📄 License

MIT — feel free to adapt for your own automation pipeline.
