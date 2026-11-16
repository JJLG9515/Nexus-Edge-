import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-[#161920] px-3.5 py-2 text-xs font-medium text-amber-300 shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Sin conexión — Bóveda y memoria local disponibles</span>
    </div>
  );
};
