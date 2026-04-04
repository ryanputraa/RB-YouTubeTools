# Changelog

## [0.3.0-alpha] - 2026-04-04

### New Features
- **Settings page** — gear icon left of the Sign In button opens a dedicated settings screen with: default output directory (browse + open-in-Explorer), default video quality, "delete videos on uninstall" checkbox, clear translation history, delete all downloads, and an uninstall shortcut.
- **Video quality selector** — when "Download Video" is enabled in the options screen, a row of quality chips appears (Best, 4K, 1080p, 720p, 480p, 360p). Defaults to the value saved in Settings; overridable per-job. Quality is mapped to the correct yt-dlp format selector.
- **Delete all downloads** — single action in Settings that removes the entire output folder from disk and clears history in one shot (history alone would be re-populated by backfill anyway).
- **Squirrel installer** — switched from NSIS to Squirrel.Windows. Silent ~1-second install, automatic desktop shortcut and Start Menu entry, seamless in-place delta updates. On uninstall, if "delete videos on uninstall" is enabled in Settings, the output folder is wiped automatically.

### Improvements
- **Arrow key seek fixed** — native `<video controls>` element was handling ArrowLeft/Right first and seeking proportionally. Fixed by registering the ±10s handler in the capture phase (`addEventListener('keydown', handler, true)`), so it intercepts before the native control.
- **Menu bar removed** — File / Edit / View native menu bar is gone (`Menu.setApplicationMenu(null)`).
- **App version badge** — version number shown in the bottom-right corner of the menu screen and in the Settings page. Injected at build time from `package.json` via a Vite `define`.
- **Default output dir respects settings** — `get-default-output-dir` and `backfill-history` now both read from `settings.json` instead of a hardcoded `Videos/RB-YouTubeTools` path.
- **Confirmation dialogs** — destructive actions in Settings (clear history, delete downloads, uninstall) now show a modal overlay with Cancel / Confirm instead of requiring two clicks on the same button.

### Rename
- Project and folder slug renamed from `RB-YouTubeTools` to `RB-YouTube-Tools` throughout the codebase, README, and output directory default path. GitHub repo updated to match.

---

## [0.2.0-alpha] - 2026-04-02

### New Features
- **YouTube IFrame embed** — when a video hasn't been downloaded, the app now embeds YouTube's actual player instead of trying to stream a direct URL. Subtitles are polled every 200ms from `getCurrentTime()` and displayed in a bar below the player, avoiding cross-origin z-index limitations.
- **Track switching (Translated / Original)** — both the local video player and the YouTube embed now let you toggle between the translated track and the original untranslated captions. The original VTT is saved alongside the translated one on every new translation.
- **Subtitle size control** — an Aa button in both players opens a popup with − / + controls, scaling subtitles from 0.6× to 2×. Local player uses dynamic `::cue` style injection; YouTube player uses inline font-size on the overlay element.
- **Download from YouTube player** — a "Want a better experience? Download instead" button inside the YouTube embed triggers a background download. A thin progress bar appears at the bottom of the player during download; on completion a banner asks if you want to switch to the local player.
- **URL suggestions dropdown** — the URL input on the home screen shows a dropdown of previously used URLs on focus, with video thumbnails and titles. Arrow keys navigate; Enter selects.
- **Three-dot context menu on history cards** — each card now has a ⋮ menu with: Copy YouTube link, Open in Explorer, and Delete (deletes the per-video folder from disk).
- **Back button on result screen** — a small ← arrow left of the video title returns to the home screen without losing translation state.

### Improvements
- **Translation speed** — batch size raised from 20 → 50 blocks, concurrency raised to 6 simultaneous batches, all artificial delays removed. Partial translation failures now trigger a retry instead of aborting.
- **Download speed** — `--concurrent-fragments 8` added to yt-dlp args for parallel fragment downloading.
- **Download startup visibility** — the IPC handler emits "Fetching video info…" immediately on invocation, and yt-dlp's stderr is forwarded to the progress callback so startup activity is visible instead of showing a frozen spinner.
- **Native fullscreen with subtitles** — local video player now uses a native `<track>` element with a Blob URL. Chromium renders it inside native fullscreen automatically; no custom fullscreen management needed.
- **Cookies auto-loaded for inline downloads** — the `download-video-now` IPC handler automatically picks up `userData/youtube-cookies.txt` so logged-in sessions work without re-entering credentials.

### Bug Fixes
- **ArrowUp blank page** — navigating up to index −1 in the suggestions list was clearing the URL input. Fixed by stopping ArrowUp at index 0.
- **Transparent dropdown** — `bg-surface` was undefined in the Tailwind config, making dropdowns and menus see-through. Replaced with `bg-base-card` (#1e2433) everywhere.
- **Partial translation error** — `google-translate-api-x` throws on any partially failed batch. Added `rejectOnPartialFail: false` and extended the retry condition to catch "Partial Translation" responses.
- **Delete deleting wrong folder** — three-dot Delete now removes `entry.outputDir` (the per-video subfolder) rather than the base RB-YouTubeTools folder.

### Under the Hood
- `VideoPlayer` rewritten to use native `<track>` + Blob URL; removed custom VTT parser, overlay div, sticky mode (replaced by native cue rendering)
- `YouTubePlayer` component added (new): IFrame API embed, 200ms poll loop, subtitle bar below iframe, download flow, CC/track/size controls
- `originalVttPath` saved in `JobResult` and `HistoryEntry`; `ResultScreen` reads and passes `originalVttContent` to both players
- `electron-builder.config.cjs` updated: correct branding, `menuCategory`, `runAfterFinish: true`, portable target added

---

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
