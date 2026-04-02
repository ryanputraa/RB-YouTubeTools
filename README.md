# RB YouTube Tools

<img src="assets/logo-white.svg" width="120" alt="RB YouTube Tools" />

A desktop app for downloading and translating YouTube auto-generated captions.

> **Current version: 0.2.0-alpha** — actively developed. Features will be added over time.

---

## Background

If you want to hear the story of why this exists: [ryanbudianto.com/projects/hobby/rb-youtubetools](https://www.ryanbudianto.com/projects/hobby/rb-youtubetools)

---

## What it does

Give it a YouTube URL, pick a source caption track and a target language, and it downloads the auto-captions and translates them using Google Translate. You get a translated `.srt` and `.vtt` file you can use anywhere — or watch the video directly in-app with translated subtitles, either via the embedded YouTube player or the local video player after downloading.

---

## Download

Head to [Releases](https://github.com/ryanputraa/RB-YouTubeTools/releases) and grab the latest:

| File | Description |
|------|-------------|
| `RB YouTube Tools Setup x.x.x.exe` | Windows installer (recommended) |
| `RB YouTube Tools x.x.x.exe` | Portable exe, no install needed |

---

## First run

The app will walk you through a setup screen on first launch:

1. **yt-dlp** — downloads automatically (required)
2. **ffmpeg** — downloads automatically (required for most videos; YouTube delivers captions as DASH fragments that need merging)

Both tools are saved to your app data folder. You don't need to install them separately.

---

## Features

- **Caption source picker** — if the video has multiple caption tracks (Korean auto, English auto, manual subs), choose which one to translate from
- **100+ target languages** — searchable dropdown
- **YouTube embed player** — watch without downloading via YouTube's own IFrame player with translated subtitles rendered below it
  - CC toggle, track switching (Translated / Original), subtitle size control
  - Download button inside the player — pulls the video in the background and offers to switch to local playback when done
- **Local video player** — full native playback after downloading
  - Arrow keys skip ±10 seconds
  - Native fullscreen with subtitles (works without any custom intercept)
  - CC toggle, track switching (Translated / Original), subtitle size control (Aa button)
- **Translation history** — last 50 translations saved, displayed as a thumbnail grid. Opening history also scans your output folder and imports any older translations automatically
  - Three-dot menu per card: Copy YouTube link, Open in Explorer, Delete folder
  - URL input suggests previously used links with thumbnails
- **YouTube login** — sign in via an in-app popup for age-restricted or rate-limited videos. Login icon in the top-right corner, persists across all screens

---

## Usage

1. Paste a YouTube URL on the home screen (or pick from suggestions)
2. On the options screen:
   - Pick the caption source (auto-selects Korean if available)
   - Pick your target language
   - Toggle "Download Video" on if you want local playback (on by default)
3. Hit Start — watch the progress screen
4. When done: read the translated captions, watch via YouTube embed, or watch locally with subs overlaid

---

## For age-restricted / rate-limited videos

Click the **Sign in** button in the top-right corner. An in-app YouTube login window will open. After signing in, your session cookies are used automatically for the next translation job.

Alternatively, export a `cookies.txt` file from your browser (Netscape format) and load it via "Use cookies.txt file".

---

## Output

Translated files are saved to `Videos/RB-YouTubeTools/<video title>/` by default. You can change the output folder per-job in the options screen. Each job produces:

- `title_lang.srt` — standard subtitle file, works in VLC and most players
- `title_lang.vtt` — translated WebVTT, used for in-app playback
- `title_original.vtt` — original untranslated captions, for track switching in-app

---

## Building from source

```bash
git clone https://github.com/ryanputraa/RB-YouTubeTools
cd RB-YouTubeTools
npm install

# Dev mode
npm run dev

# Build installer
npm run dist:win
```

Requires Node.js 18+ and npm.

---

## Known limitations

- Translation quality depends on Google Translate. Korean → English works well; other pairs vary.
- Livestream archives and some rate-limited videos may fail even with login cookies.
- Only auto-generated captions are fetched by default. Manual subtitles can be selected in the caption source picker if the video has them.
- macOS and Linux builds are untested.

---

## Roadmap

- Batch URL / playlist input
- DeepL as an alternative translation provider
- Subtitle timing offset controls
- Clipboard URL auto-paste on launch
- Auto-update support
- Full YouTube toolset (the name is doing work)

---

## License

MIT
