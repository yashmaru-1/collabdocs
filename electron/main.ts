import { app, BrowserWindow } from 'electron'
import path from 'path'

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        title: 'CollabDocs',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    const isDev = process.env.ELECTRON_DEV !== '0' && !app.isPackaged

    if (isDev) {
        // Dev: load from Next.js dev server (localhost)
        win.loadURL('http://localhost:3000')
        win.webContents.openDevTools()
    } else {
        // Production: load the hosted cloud URL
        // Set COLLAB_DOCS_URL env var to your Vercel deployment URL
        // e.g. COLLAB_DOCS_URL=https://collabdocs.vercel.app
        const cloudUrl = process.env.COLLAB_DOCS_URL || 'https://collabdocs.vercel.app'
        win.loadURL(cloudUrl)
    }
}

app.whenReady().then(() => {
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
