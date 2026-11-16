import * as THREE from 'three';

export class LoungeTV {
  private tvMesh: THREE.Mesh | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private videoTexture: THREE.VideoTexture | null = null;
  private canvasTexture: THREE.CanvasTexture | null = null;
  private idleCanvas: HTMLCanvasElement | null = null;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private currentStream: MediaStream | null = null;
  private lastRenderedMinute: string = '';
  public sharerName: string = '';

  constructor(tvMesh: THREE.Mesh) {
    this.tvMesh = tvMesh;
    this.createIdleCanvas();
    this.startIdleClock();
    this.showIdleScreen();
  }

  private createIdleCanvas() {
    this.idleCanvas = document.createElement('canvas');
    this.idleCanvas.width = 960;
    this.idleCanvas.height = 540;
    this.canvasTexture = new THREE.CanvasTexture(this.idleCanvas);
    this.canvasTexture.colorSpace = THREE.SRGBColorSpace;
  }

  private renderIdleCanvas(force = false) {
    if (!this.idleCanvas) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    if (!force && this.lastRenderedMinute === timeString) return;
    this.lastRenderedMinute = timeString;

    const ctx = this.idleCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.idleCanvas.width;
    const h = this.idleCanvas.height;

    // Deep sleek dark gradient matching Image 2
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0a0814');
    bgGrad.addColorStop(0.5, '#120d22');
    bgGrad.addColorStop(1, '#0e0b1c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle dark grid
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
    ctx.lineWidth = 1.0;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Outer subtle glowing edge
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // 1. Digital Clock (Image 2: "1:02 PM")
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 78px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(129, 140, 248, 0.7)';
    ctx.shadowBlur = 20;
    ctx.fillText(timeString, w / 2, h / 2 - 48);

    // 2. Subtitle prompt (Image 2)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '500 22px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('No one is sharing their screen.', w / 2, h / 2 + 18);

    ctx.fillStyle = '#6b7280';
    ctx.font = '400 15px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('Start sharing your screen or stream to watch together.', w / 2, h / 2 + 50);

    // 3. YouTube & Web Screen Share Action Buttons (Image 2)
    const drawPillButton = (x: number, y: number, label: string, isYoutube: boolean) => {
      ctx.save();
      const bw = 130;
      const bh = 36;
      const r = 10;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, r);
      ctx.fill();
      ctx.stroke();

      // Icon
      const iconX = x - 35;
      if (isYoutube) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(iconX - 10, y - 7, 20, 14, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(iconX - 3, y - 4);
        ctx.lineTo(iconX + 4, y);
        ctx.lineTo(iconX - 3, y + 4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(iconX, y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌐', iconX, y);
      }

      // Text
      ctx.fillStyle = '#f3f4f6';
      ctx.font = '600 13px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x - 18, y);

      ctx.restore();
    };

    drawPillButton(w / 2 - 80, h / 2 + 105, 'YouTube', true);
    drawPillButton(w / 2 + 80, h / 2 + 105, 'Screen Share', false);

    if (this.canvasTexture) {
      this.canvasTexture.needsUpdate = true;
    }
  }

  private startIdleClock() {
    this.renderIdleCanvas(true);
    this.idleTimer = setInterval(() => {
      if (!this.currentStream) {
        this.renderIdleCanvas();
      }
    }, 1000);
  }

  public showIdleScreen() {
    this.stopVideoStream();
    this.renderIdleCanvas(true);
    if (this.tvMesh && this.canvasTexture) {
      const mat = this.tvMesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(0xffffff);
      mat.map = this.canvasTexture;
      mat.emissive.setHex(0xffffff);
      mat.emissiveMap = this.canvasTexture;
      mat.emissiveIntensity = 1.0;
      mat.roughness = 0.15;
      mat.metalness = 0.05;
      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;
    }
  }

  public setStream(stream: MediaStream | null, sharerName?: string) {
    if (!stream) {
      this.currentStream = null;
      this.sharerName = '';
      this.showIdleScreen();
      return;
    }

    if (this.currentStream === stream && this.videoTexture) {
      return;
    }

    this.currentStream = stream;
    this.sharerName = sharerName || 'Live Screen';

    // Create or reuse hidden HTMLVideoElement
    if (!this.videoEl) {
      this.videoEl = document.createElement('video');
      this.videoEl.autoplay = true;
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;
      this.videoEl.style.display = 'none';
      document.body.appendChild(this.videoEl);
    }

    this.videoEl.srcObject = stream;
    this.videoEl.play().catch((err) => {
      console.warn('[LoungeTV] video play interrupted:', err);
    });

    if (this.videoTexture) {
      this.videoTexture.dispose();
    }

    this.videoTexture = new THREE.VideoTexture(this.videoEl);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.format = THREE.RGBAFormat;
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;

    if (this.tvMesh) {
      const mat = this.tvMesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(0xffffff);
      mat.map = this.videoTexture;
      mat.emissive.setHex(0xffffff);
      mat.emissiveMap = this.videoTexture;
      mat.emissiveIntensity = 1.0;
      mat.roughness = 0.1;
      mat.metalness = 0.0;
      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;
    }
  }

  private stopVideoStream() {
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.srcObject = null;
    }
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
  }

  public dispose() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.stopVideoStream();
    if (this.videoEl && this.videoEl.parentNode) {
      this.videoEl.parentNode.removeChild(this.videoEl);
    }
    if (this.canvasTexture) this.canvasTexture.dispose();
  }
}
