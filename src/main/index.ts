import { app, BrowserWindow, Menu } from 'electron'
import { join, dirname, basename } from 'path'
import { existsSync, readFileSync, rmSync } from 'fs'
import { spawn } from 'child_process'
import { registerAllIpcHandlers } from './ipc'
import { startFileServer } from './services/fileServer'

Menu.setApplicationMenu(null)

// ── Squirrel lifecycle (Windows installer events) ────────────────────────────
// Squirrel calls the app with a special argv[1] during install/update/uninstall.
// We must create/remove shortcuts via Update.exe and then quit.
// --squirrel-firstrun is NOT a lifecycle event — it's the normal first launch
// after install and must fall through so the app opens normally.
if (process.platform === 'win32') {
  const squirrelEvent = process.argv[1]
  if (squirrelEvent?.startsWith('--squirrel-') && squirrelEvent !== '--squirrel-firstrun') {
    const updateExe = join(dirname(process.execPath), '..', 'Update.exe')
    const exeName = basename(process.execPath)

    const spawnUpdate = (args: string[]) => {
      try { spawn(updateExe, args, { detached: true }).unref() } catch {}
    }

    if (squirrelEvent === '--squirrel-install' || squirrelEvent === '--squirrel-updated') {
      // Create/update desktop + start menu shortcuts pointing to current version
      spawnUpdate(['--createShortcut', exeName])
    } else if (squirrelEvent === '--squirrel-obsolete') {
      // Old version being retired by an update — Squirrel handles file cleanup automatically
    } else if (squirrelEvent === '--squirrel-uninstall') {
      // Remove shortcuts
      spawnUpdate(['--removeShortcut', exeName])
      // Honour "wipe videos on uninstall" setting
      try {
        const settingsPath = join(app.getPath('userData'), 'settings.json')
        if (existsSync(settingsPath)) {
          const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
          if (settings.wipeOnUninstall && settings.outputDir && existsSync(settings.outputDir)) {
            rmSync(settings.outputDir, { recursive: true, force: true })
          }
        }
      } catch {}
    }

    // Give Update.exe a moment to spawn before we exit
    setTimeout(() => app.quit(), 1000)
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#12151C',
    titleBarStyle: 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  // Start local file server for serving video/caption files to the renderer
  await startFileServer()

  registerAllIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
