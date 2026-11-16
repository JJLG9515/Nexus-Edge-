import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`flex items-center justify-center gap-2 rounded-xl bg-sky-500 text-slate-950 font-semibold transition-colors hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap shrink-0 ${
          compact ? 'px-3 py-2 text-xs min-h-[44px]' : 'w-full px-4 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Instalar en dispositivo</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={`flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#161920] text-slate-200 font-medium transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap shrink-0 ${
          compact ? 'px-3 py-2 text-xs min-h-[44px]' : 'w-full px-4 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
        <span>Instalar como app (PWA)</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101216] p-6 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h3 id="pwa-guide-title" className="text-lg font-semibold font-display">
                Instalar Nexus Edge en tu teléfono
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Cerrar guía de instalación"
                className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {isIOS ? (
              <ol className="mt-4 space-y-2 text-sm text-slate-300 leading-relaxed list-decimal list-inside">
                <li>Pulsa el botón Compartir en Safari.</li>
                <li>Selecciona Añadir a pantalla de inicio.</li>
                <li>Confirma para abrir Nexus Edge sin barra de navegador.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2 text-sm text-slate-300 leading-relaxed list-decimal list-inside">
                <li>Abre esta aplicación en Chrome desde tu Motorola Edge 50 Pro.</li>
                <li>Pulsa el menú del navegador (tres puntos arriba a la derecha).</li>
                <li>Elige Instalar aplicación o Añadir a pantalla de inicio.</li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
