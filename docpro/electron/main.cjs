// electron/main.cjs
const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow = null;

// ✅ Prevent multiple running instances (double-clicking the app icon)
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to run a second instance — focus existing window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  function createOrFocusWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      return;
    }

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const indexPath = path.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexPath);

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    createOrFocusWindow();

    // ✅ Dock icon click should focus existing window, not open a new one
    app.on("activate", () => {
      createOrFocusWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
    