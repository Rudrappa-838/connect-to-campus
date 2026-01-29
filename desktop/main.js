const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;
// TODO: Replace with your actual Live URL after deployment
const LIVE_URL = 'http://52.66.13.31'; // Using the AWS IP for now based on context

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Connect To Campus",
        // icon: path.join(__dirname, 'icon.ico'), // Add icon later
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Function to load the app
    const loadApp = () => {
        mainWindow.loadURL(LIVE_URL).catch(err => {
            console.log('Failed to load URL, might be offline:', err);
            mainWindow.loadFile(path.join(__dirname, 'offline.html'));
        });
    };

    loadApp();

    // Handle Failures (Offline)
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.log('Page failed to load:', errorCode, errorDescription);
        // Only redirect to offline page if it's a network error
        if (errorCode === -106 || errorCode === -105 || errorCode === -102) {
            mainWindow.loadFile(path.join(__dirname, 'offline.html'));
        }
    });

    // Custom "Retry" handler via query string or just reloading
    // We can also inject scripts to handle "Retry" button from offline.html
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
