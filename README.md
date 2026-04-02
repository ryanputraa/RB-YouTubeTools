# RB YouTube Tools

A desktop app for downloading and translating YouTube auto-generated captions.

![RB YouTube Tools](assets/logo-white.svg)

> **Current version: 0.1.1-alpha** — actively developed. Features will be added over time.

---

## What it does

Give it a YouTube URL, pick a source caption track and a target language, and it downloads the auto-captions and translates them using Google Translate. You get a translated `.srt` and `.vtt` file you can use anywhere — or watch the video directly in-app with the translated subtitles overlaid.

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

- **Caption source picker** — if the video has multiple caption tracks (Korean auto, English auto, manual subs), you can choose which one to translate from
- **100+ target languages** — searchable dropdown
- **In-app video player** — watch the video with translated subtitles overlaid directly in the app
  - Arrow keys skip ±10 seconds (like YouTube)
  - **Sticky captions** — caption stays on screen until the next one arrives, instead of disappearing at the end timestamp. Useful when YouTube's timing is off
  - CC button to toggle subtitles on/off
- **Translation history** — the last 50 translations are saved. Opening history also scans your output folder and imports any older translations automatically
- **YouTube login** — sign in via an in-app popup for age-restricted or rate-limited videos. The login icon lives in the top-right corner and persists across all screens

---

## Usage

1. Paste a YouTube URL on the home screen
2. On the options screen:
   - Pick the caption source (auto-selects Korean if available)
   - Pick your target language
   - Toggle "Download Video" on if you want to watch in-app (on by default)
3. Hit Start — watch the progress screen
4. When done: read the translated captions, or watch the video with subs overlaid

---

## For age-restricted / rate-limited videos

Click the **Sign in** button in the top-right corner. An in-app YouTube login window will open. After signing in, your session cookies are used automatically for the next translation job.

Alternatively, export a `cookies.txt` file from your browser (Netscape format) and load it via "Use cookies.txt file".

---

## Output

Translated files are saved to `Videos/RB-YouTubeTools/<video title>/` by default. You can change the output folder per-job in the options screen. Each job produces:

- `title_lang.srt` — standard subtitle file, works in VLC and most players
- `title_lang.vtt` — WebVTT format, used for in-app playback

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
- macOS and Linux builds are untested in this release.

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
