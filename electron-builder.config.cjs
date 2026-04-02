/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.rb.youtubetools',
  productName: 'RB YouTube Tools',
  copyright: 'Copyright © 2026 Ryan Budianto',
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
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] }
    ],
    icon: 'build/icon.ico'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'RB YouTube Tools',
    menuCategory: 'RB YouTube Tools',
    runAfterFinish: true,
    perMachine: false,
    include: 'build/uninstaller.nsh'
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
