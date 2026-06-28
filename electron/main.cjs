const { app, BrowserWindow, Menu, dialog, screen, shell } = require('electron')
const path = require('path')

const RELEASES_URL = 'https://github.com/Lunora-Gather/astra-voxel-ark/releases'
let mainWindow = null
let manualUpdateCheck = false

function getAutoUpdater() {
  try {
    return require('electron-updater').autoUpdater
  } catch {
    return null
  }
}

const autoUpdater = getAutoUpdater()

function showUpdateMessage(options) {
  const target = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined
  return target ? dialog.showMessageBox(target, options) : dialog.showMessageBox(options)
}

function openReleasesPage() {
  shell.openExternal(RELEASES_URL)
}

function checkForUpdates(manual = false) {
  manualUpdateCheck = manual

  if (!app.isPackaged || !autoUpdater) {
    if (manual) {
      showUpdateMessage({
        type: 'info',
        title: 'Updates',
        message: 'Updates are available from GitHub Releases after the app is packaged.',
        buttons: ['Open Releases', 'OK'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) openReleasesPage()
      })
    }
    return
  }

  autoUpdater.checkForUpdates().catch((error) => {
    if (!manual) return
    showUpdateMessage({
      type: 'warning',
      title: 'Update Check Failed',
      message: 'Could not check for updates automatically.',
      detail: error?.message || 'Open GitHub Releases to download the latest installer manually.',
      buttons: ['Open Releases', 'OK'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) openReleasesPage()
    })
  })
}

function configureUpdates() {
  if (!autoUpdater) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    manualUpdateCheck = false
    showUpdateMessage({
      type: 'info',
      title: 'Update Available',
      message: `AstraVoxel Ark ${info.version} is available.`,
      detail: 'Download it now and install when ready?',
      buttons: ['Download Update', 'Later', 'Open Releases'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate()
      if (response === 2) openReleasesPage()
    })
  })

  autoUpdater.on('update-not-available', () => {
    const shouldNotify = manualUpdateCheck
    manualUpdateCheck = false
    if (!shouldNotify) return
    showUpdateMessage({
      type: 'info',
      title: 'No Updates',
      message: 'AstraVoxel Ark is up to date.',
      buttons: ['OK'],
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    showUpdateMessage({
      type: 'info',
      title: 'Update Ready',
      message: `AstraVoxel Ark ${info.version} has been downloaded.`,
      detail: 'Restart now to install the update.',
      buttons: ['Restart and Install', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on('error', (error) => {
    const shouldNotify = manualUpdateCheck
    manualUpdateCheck = false
    if (!shouldNotify) return
    showUpdateMessage({
      type: 'warning',
      title: 'Update Check Failed',
      message: 'Could not check for updates automatically.',
      detail: error?.message || 'Open GitHub Releases to download the latest installer manually.',
      buttons: ['Open Releases', 'OK'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) openReleasesPage()
    })
  })
}

function createMenu() {
  const template = [
    {
      label: 'AstraVoxel Ark',
      submenu: [
        { label: 'Check for Updates', click: () => checkForUpdates(true) },
        { label: 'Open Releases', click: openReleasesPage },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const windowWidth = Math.min(1280, Math.max(960, Math.floor(width * 0.86)))
  const windowHeight = Math.min(720, Math.max(540, Math.floor(windowWidth * 9 / 16)))

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 960,
    minHeight: 540,
    title: 'AstraVoxel Ark',
    backgroundColor: '#0b1020',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  createMenu()
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  configureUpdates()
  createWindow()
  setTimeout(() => checkForUpdates(false), 3000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
