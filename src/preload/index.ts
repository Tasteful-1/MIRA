import { contextBridge, ipcRenderer } from "electron";

import type { ProjectSnapshot } from "../shared/types";

export interface MiraApi {
  getMiraDirectory: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  loadProjectFolder: (rootPath: string) => Promise<ProjectSnapshot>;
  openProjectFolder: (defaultPath?: string) => Promise<ProjectSnapshot | null>;
  chooseDirectory: (defaultPath?: string) => Promise<string | null>;
  loadTilesetImage: (rootPath: string, tilesetName: string) => Promise<string>;
  loadCharacterImage: (rootPath: string, characterName: string) => Promise<string>;
}

const api: MiraApi = {
  getMiraDirectory: () => ipcRenderer.invoke("mira:get-mira-directory") as Promise<string>,
  getAppVersion: () => ipcRenderer.invoke("mira:get-app-version") as Promise<string>,
  loadProjectFolder: (rootPath) => ipcRenderer.invoke("mira:load-project-folder", rootPath) as Promise<ProjectSnapshot>,
  openProjectFolder: (defaultPath) =>
    ipcRenderer.invoke("mira:open-project-folder", defaultPath) as Promise<ProjectSnapshot | null>,
  chooseDirectory: (defaultPath) => ipcRenderer.invoke("mira:choose-directory", defaultPath) as Promise<string | null>,
  loadTilesetImage: (rootPath, tilesetName) =>
    ipcRenderer.invoke("mira:load-tileset-image", rootPath, tilesetName) as Promise<string>,
  loadCharacterImage: (rootPath, characterName) =>
    ipcRenderer.invoke("mira:load-character-image", rootPath, characterName) as Promise<string>,
};

contextBridge.exposeInMainWorld("mira", api);
