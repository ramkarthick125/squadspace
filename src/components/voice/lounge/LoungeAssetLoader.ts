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
          const raw = await (window as any).electronAPI.loadModelBuffer(fileName);
          if (raw) {
            let arrayBuffer: ArrayBuffer | null = null;
            if (raw instanceof ArrayBuffer) {
              arrayBuffer = raw;
            } else if (ArrayBuffer.isView(raw)) {
              arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
            } else if (raw.buffer && raw.buffer instanceof ArrayBuffer) {
              arrayBuffer = (raw.buffer as ArrayBuffer).slice(raw.byteOffset || 0, (raw.byteOffset || 0) + (raw.byteLength || raw.length));
            } else if (raw.data && Array.isArray(raw.data)) {
              arrayBuffer = new Uint8Array(raw.data).buffer as ArrayBuffer;
            } else if (typeof raw === 'object' && raw.length !== undefined) {
              arrayBuffer = new Uint8Array(raw).buffer as ArrayBuffer;
            }

            if (arrayBuffer && arrayBuffer.byteLength > 0) {
              try {
                this.loader.parse(
                  arrayBuffer,
                  '',
                  (gltf) => {
                    this.cache.set(url, gltf);
                    this.pendingPromises.delete(url);
                    resolve(gltf);
                  },
                  (parseErr) => {
                    console.warn(`[LoungeAssetLoader] Parse buffer error for ${fileName}, trying Blob URL:`, parseErr);
                    this.loadViaBlobUrl(arrayBuffer!, url, resolve, reject);
                  }
                );
                return;
              } catch (parseEx) {
                console.warn(`[LoungeAssetLoader] Parse exception for ${fileName}, trying Blob URL:`, parseEx);
                this.loadViaBlobUrl(arrayBuffer, url, resolve, reject);
                return;
              }
            }
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

  private loadViaBlobUrl(
    buffer: ArrayBuffer,
    url: string,
    resolve: (gltf: GLTF) => void,
    reject: (err: any) => void
  ) {
    try {
      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      const blobUrl = URL.createObjectURL(blob);
      this.loader.load(
        blobUrl,
        (gltf) => {
          URL.revokeObjectURL(blobUrl);
          this.cache.set(url, gltf);
          this.pendingPromises.delete(url);
          resolve(gltf);
        },
        undefined,
        (err) => {
          URL.revokeObjectURL(blobUrl);
          this.pendingPromises.delete(url);
          console.error(`[LoungeAssetLoader] Blob URL loading failed for ${url}:`, err);
          this.loadViaFetch(url, resolve, reject);
        }
      );
    } catch (err) {
      this.loadViaFetch(url, resolve, reject);
    }
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
