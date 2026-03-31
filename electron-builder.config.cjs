/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.rb.yt-video-translator',
  productName: 'RB YT Video Translator',
  copyright: 'Copyright © 2024 RB',
  directories: {
    buildResources: 'build',
    output: 'dist'
  },
  files: ['out/**/*'],
  extraResources: [
    {
      from: 'resources/',
      to: '.',
      filter: ['**/*']
    }
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.ico'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'RB YT Video Translator'
  },
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    icon: 'build/icon.icns',
    category: 'public.app-category.utilities'
  },
  linux: {
    target: ['AppImage'],
    icon: 'build/icons',
    category: 'Utility'
  }
}
