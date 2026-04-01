# Changelog

## [0.1.1-alpha] - 2026-04-01

### New Features
- **Caption source picker** — choose which language track to translate from. If the video has Korean auto-captions, the app now pre-selects those automatically. Auto-detect mode falls back to the previous behaviour (English chain).
- **YouTube login in header** — sign-in and sign-out moved to a persistent profile dropdown in the top-right corner, available on all screens. No more hunting for it in the options page.
- **Sticky captions** — new toggle in the video player. When enabled, a caption line stays on screen until the next one appears instead of disappearing at its end timestamp. Useful when YouTube's auto-caption timing is off.
- **Captions on/off toggle** — CC button in the video player to show or hide subtitles.
- **History backfill** — opening the history screen now scans your output folder and automatically imports any translation folders from older versions of the app or manual runs.
- **NSIS installer** — Windows setup wizard (`RB YouTube Tools Setup 0.1.1-alpha.exe`) alongside the portable exe. Lets you install to a custom directory with Start Menu and Desktop shortcuts.

### Improvements
- **Arrow keys seek ±10 seconds** in the video player, matching YouTube's behaviour. Previously arrow keys moved by a percentage of the video duration which was impractical for long videos.
- **VTT subtitle formatting fix** — YouTube delivers Korean auto-captions as accumulating word-by-word cues (each cue builds on the last, all sharing the same start timestamp). The parser now groups cues by start time and keeps only the final, complete version. This significantly reduces garbled or fragment-only subtitle blocks.
- **Download video on by default** — the download video toggle is now enabled by default since the in-app player is the primary way to use translations. A note explains that downloaded videos can be watched with subtitles directly in the app.
- **Logo click navigates home** — clicking the logo from any screen returns to the home screen.
- **Rename** — UI updated from "YT Video Translator" to "RB YouTube Tools" throughout.

### Under the Hood
- `CaptionTrack` type added to `shared/types.ts`; `VideoInfo` now includes `availableCaptions[]` populated from yt-dlp's `--dump-json` output
- `downloadCaptions` accepts a `sourceLang` parameter; fallback chain uses that language instead of hardcoded English
- Custom subtitle overlay in `VideoPlayer` replaces the native `<track>` element — required for sticky mode and the on/off toggle
- `backfill-history` IPC handler scans the output directory and adds missing entries to `history.json`
- nodepapago evaluated as a Papago scraper replacement — crashes on construction, not viable. Staying on google-translate-api-x.

---

## [0.1.0-alpha] - 2026-03-xx

Initial release.

- Auto-caption download via yt-dlp (English fallback chain)
- Batch translation via Google Translate (unofficial)
- First-run setup: yt-dlp and ffmpeg download
- In-app video playback with translated VTT track
- Translation history (last 50 entries)
- YouTube login popup via Electron session for age-restricted videos
- SRT + VTT export
