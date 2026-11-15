import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class LoungeAssetLoader {
  private static instance: LoungeAssetLoader;
  private loader: GLTFLoader = new GLTFLoader();
  private cache: Map<string, GLTF> = new Map();
  private pendingPromises: Map<string, Promise<GLTF>> = new Map();

  private constructor() {}

  public static getInstance(): LoungeAssetLoader {
    if (!LoungeAssetLoader.instance) {
      LoungeAssetLoader.instance = new LoungeAssetLoader();
    }
    return LoungeAssetLoader.instance;
  }

  public async loadModel(url: string): Promise<GLTF> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    if (this.pendingPromises.has(url)) {
      return this.pendingPromises.get(url)!;
    }

    const promise = new Promise<GLTF>(async (resolve, reject) => {
      const fileName = url.split('/').pop() || url;

      // 1. First priority: Load raw ArrayBuffer directly via Electron IPC
      // This is 100% resilient inside packaged app.asar on Windows/macOS/Linux!
      if (typeof window !== 'undefined' && (window as any).electronAPI?.loadModelBuffer) {
        try {
          const buffer = await (window as any).electronAPI.loadModelBuffer(fileName);
          if (buffer && buffer.byteLength > 0) {
            this.loader.parse(
              buffer,
              '',
              (gltf) => {
                this.cache.set(url, gltf);
                this.pendingPromises.delete(url);
                resolve(gltf);
              },
              (parseErr) => {
                console.warn(`[LoungeAssetLoader] Parse buffer error for ${fileName}, falling back:`, parseErr);
                this.loadViaFetch(url, resolve, reject);
              }
            );
            return;
          }
        } catch (ipcErr) {
          console.warn(`[LoungeAssetLoader] IPC loadModelBuffer error for ${fileName}:`, ipcErr);
        }
      }

      // 2. Second priority: Standard fetch loader (Vite dev server / web browser)
      this.loadViaFetch(url, resolve, reject);
    });

    this.pendingPromises.set(url, promise);
    return promise;
  }

  private loadViaFetch(url: string, resolve: (gltf: GLTF) => void, reject: (err: any) => void) {
    let targetUrl = url;
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      // Clean leading slash so it resolves relative to dist/index.html instead of drive root C:\
      const cleanPath = url.replace(/^[\/\.]+/, '');
      targetUrl = new URL(cleanPath, window.location.href).href;
    }

    this.loader.load(
      targetUrl,
      (gltf) => {
        this.cache.set(url, gltf);
        this.pendingPromises.delete(url);
        resolve(gltf);
      },
      undefined,
      (error) => {
        this.pendingPromises.delete(url);
        console.error(`[LoungeAssetLoader] Failed to load 3D model via fetch: ${targetUrl}`, error);
        reject(error);
      }
    );
  }
}
