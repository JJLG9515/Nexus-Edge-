import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload, X } from 'lucide-react';
import type { ChatAttachment } from '../types';

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (attachment: ChatAttachment) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ open, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setReady(false);
      return;
    }

    let cancelled = false;
    setCameraError(null);
    setReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('La cámara en vivo no está disponible en este navegador. Usa subir imagen.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError('No se pudo acceder a la cámara. Puedes seleccionar o tomar una foto desde archivos.');
        }
      });

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, facingMode]);

  if (!open) return null;

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    const maxW = 1280;
    const scale = video.videoWidth > maxW ? maxW / video.videoWidth : 1;
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64Data = dataUrl.split(',')[1] || '';
    onCapture({
      id: `att-${Date.now()}`,
      mimeType: 'image/jpeg',
      base64Data,
      previewUrl: dataUrl,
      label: `Captura de cámara (${facingMode === 'environment' ? 'trasera' : 'frontal'})`,
    });
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64Data = result.split(',')[1] || '';
      if (!base64Data) return;
      onCapture({
        id: `att-${Date.now()}`,
        mimeType: file.type || 'image/jpeg',
        base64Data,
        previewUrl: result,
        label: file.name,
      });
      onClose();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#101216] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <h3 id="camera-modal-title" className="text-base font-semibold text-white font-display">
            Visión de cámara
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cámara"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full bg-[#07080A] flex items-center justify-center">
          {cameraError ? (
            <div className="px-6 text-center space-y-3">
              <Camera className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-300">{cameraError}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
              className="min-h-[44px] flex items-center gap-2 rounded-xl border border-white/10 bg-[#161920] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Cambiar lente</span>
            </button>

            <label className="min-h-[44px] flex items-center gap-2 rounded-xl border border-white/10 bg-[#161920] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0">
              <Upload className="w-4 h-4" />
              <span>Subir foto</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={!ready}
            onClick={handleSnap}
            className="min-h-[44px] flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            <Camera className="w-4 h-4" />
            <span>Capturar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
