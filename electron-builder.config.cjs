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
      { target: 'squirrel', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] }
    ],
    icon: 'build/icon.ico'
  },
  squirrelWindows: {
    iconUrl: 'https://raw.githubusercontent.com/ryanbudianto/RB-YouTube-Tools/master/build/icon.ico',
    useAppIdAsId: true
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
