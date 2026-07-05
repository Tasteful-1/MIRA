/// <reference types="vite/client" />

import type { MiraApi } from "../preload";

declare global {
  interface Window {
    mira: MiraApi;
  }
}

export {};
