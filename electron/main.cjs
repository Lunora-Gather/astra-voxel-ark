const { app, BrowserWindow, Menu, screen } = require('electron')
const path = require('path')

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const windowWidth = Math.min(1280, Math.max(960, Math.floor(width * 0.86)))
  const windowHeight = Math.min(720, Math.max(540, Math.floor(windowWidth * 9 / 16)))

  const win = new BrowserWindow({
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
    },
  })

  Menu.setApplicationMenu(null)
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
