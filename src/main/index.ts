import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";

import { loadCharacterImageDataUrl, loadRpgMakerProject, loadTilesetImageDataUrl } from "./projectLoader";

function createWindow(): void {
  const icon = getWindowIconPath();
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: "MIRA",
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

ipcMain.handle("mira:get-mira-directory", () => getMiraDirectory());

ipcMain.handle("mira:get-app-version", () => app.getVersion());

ipcMain.handle("mira:load-project-folder", (_event, rootPath: string) => loadRpgMakerProject(rootPath));

ipcMain.handle("mira:load-tileset-image", (_event, rootPath: string, tilesetName: string) =>
  loadTilesetImageDataUrl(rootPath, tilesetName),
);

ipcMain.handle("mira:load-character-image", (_event, rootPath: string, characterName: string) =>
  loadCharacterImageDataUrl(rootPath, characterName),
);

ipcMain.handle("mira:open-project-folder", async (_event, defaultPath?: string) => {
  const result = await dialog.showOpenDialog({
    defaultPath: getDialogDefaultPath(defaultPath),
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return loadRpgMakerProject(result.filePaths[0]);
});

ipcMain.handle("mira:choose-directory", async (_event, defaultPath?: string) => {
  const result = await dialog.showOpenDialog({
    defaultPath: getDialogDefaultPath(defaultPath),
    properties: ["openDirectory"],
  });

  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

void app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function getDialogDefaultPath(defaultPath?: string): string {
  return defaultPath && existsSync(defaultPath) ? defaultPath : getMiraDirectory();
}

function getMiraDirectory(): string {
  return app.getAppPath();
}

function getWindowIconPath(): string | undefined {
  const iconPath = app.isPackaged ? path.join(process.resourcesPath, "icon.ico") : path.join(getMiraDirectory(), "build", "icon.ico");

  return existsSync(iconPath) ? iconPath : undefined;
}
