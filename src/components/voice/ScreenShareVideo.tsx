import React, { useEffect, useRef } from 'react';
import { ScreenShare, Maximize2 } from 'lucide-react';

interface ScreenShareVideoProps {
  stream: MediaStream | null;
  sharerName: string;
}

export const ScreenShareVideo: React.FC<ScreenShareVideoProps> = ({ stream, sharerName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  if (!stream) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 rounded-xl p-4">
        <ScreenShare className="w-12 h-12 text-discord-green mb-2 animate-pulse" />
        <span className="text-sm font-semibold text-white">{sharerName}'s Screen</span>
        <span className="text-xs text-discord-gray-400">Waiting for video stream...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted // Muted locally to prevent audio feedback loop
        className="w-full h-full object-contain bg-black"
      />

      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded text-xs font-semibold text-white flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-discord-green animate-pulse" />
        <span>{sharerName}'s Live Screen</span>
      </div>

      <button
        onClick={handleFullscreen}
        title="Fullscreen"
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-opacity"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
};
