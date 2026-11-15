import * as THREE from 'three';

export class LoungeTV {
  private tvMesh: THREE.Mesh | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private videoTexture: THREE.VideoTexture | null = null;
  private canvasTexture: THREE.CanvasTexture | null = null;
  private idleCanvas: HTMLCanvasElement | null = null;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private currentStream: MediaStream | null = null;
  private sharerName: string = '';

  constructor(tvMesh: THREE.Mesh) {
    this.tvMesh = tvMesh;
    this.createIdleCanvas();
    this.startIdleClock();
    this.showIdleScreen();
  }

  private createIdleCanvas() {
    this.idleCanvas = document.createElement('canvas');
    this.idleCanvas.width = 1280;
    this.idleCanvas.height = 720;
    this.canvasTexture = new THREE.CanvasTexture(this.idleCanvas);
    this.canvasTexture.colorSpace = THREE.SRGBColorSpace;
  }

  private renderIdleCanvas() {
    if (!this.idleCanvas) return;
    const ctx = this.idleCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.idleCanvas.width;
    const h = this.idleCanvas.height;

    // Dark sleek cyberpunk background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0c0a14');
    bgGrad.addColorStop(0.5, '#161226');
    bgGrad.addColorStop(1, '#0e0b1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.08)';
    ctx.lineWidth = 1;
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

    // Outer glowing border
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    // Digital Clock
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(129, 140, 248, 0.6)';
    ctx.shadowBlur = 20;
    ctx.fillText(timeString, w / 2, h / 2 - 60);

    // Prompt Message
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '500 28px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('No one is sharing their screen', w / 2, h / 2 + 30);

    ctx.fillStyle = '#6b7280';
    ctx.font = '400 20px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('Start screen sharing below to watch movies, YouTube, or gameplay on this TV', w / 2, h / 2 + 75);

    // Action Badges (YouTube & Web Share)
    const drawBadge = (x: number, y: number, text: string, iconColor: string) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      const bw = 160;
      const bh = 44;
      const r = 10;
      ctx.beginPath();
      ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, r);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = iconColor;
      ctx.beginPath();
      ctx.arc(x - 50, y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e5e7eb';
      ctx.font = '600 16px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x - 35, y);
      ctx.restore();
    };

    drawBadge(w / 2 - 95, h / 2 + 150, 'YouTube', '#ef4444');
    drawBadge(w / 2 + 95, h / 2 + 150, 'Co-op TV', '#6366f1');

    if (this.canvasTexture) {
      this.canvasTexture.needsUpdate = true;
    }
  }

  private startIdleClock() {
    this.renderIdleCanvas();
    this.idleTimer = setInterval(() => {
      if (!this.currentStream) {
        this.renderIdleCanvas();
      }
    }, 1000);
  }

  public showIdleScreen() {
    this.stopVideoStream();
    this.renderIdleCanvas();
    if (this.tvMesh && this.canvasTexture) {
      const mat = this.tvMesh.material as THREE.MeshStandardMaterial;
      mat.map = this.canvasTexture;
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveMap = this.canvasTexture;
      mat.emissiveIntensity = 0.9;
      mat.roughness = 0.2;
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

    if (!this.videoEl) {
      this.videoEl = document.createElement('video');
      this.videoEl.autoplay = true;
      this.videoEl.playsInline = true;
      this.videoEl.muted = true; // Mute element to prevent loopback; audio is routed via WebRTC
    }

    this.videoEl.srcObject = stream;
    this.videoEl.onloadedmetadata = () => {
      this.videoEl?.play().catch(() => {});
      if (this.videoTexture) {
        this.videoTexture.needsUpdate = true;
      }
    };
    this.videoEl.play().catch(() => {});

    if (this.videoTexture) {
      this.videoTexture.dispose();
    }

    this.videoTexture = new THREE.VideoTexture(this.videoEl);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;

    if (this.tvMesh) {
      const mat = this.tvMesh.material as THREE.MeshStandardMaterial;
      mat.map = this.videoTexture;
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveMap = this.videoTexture;
      mat.emissiveIntensity = 1.0;
      mat.roughness = 0.1;
      mat.metalness = 0.05;
      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;
    }
  }

  private stopVideoStream() {
    if (this.videoEl) {
      try {
        this.videoEl.pause();
        this.videoEl.srcObject = null;
      } catch {}
    }
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
  }

  public dispose() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
    this.stopVideoStream();
    if (this.canvasTexture) {
      this.canvasTexture.dispose();
      this.canvasTexture = null;
    }
    this.idleCanvas = null;
  }
}
