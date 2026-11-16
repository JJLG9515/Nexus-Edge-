import React from 'react';
import { Compass, MapPin, Smartphone } from 'lucide-react';
import type { HardwareSnapshot, UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface DeviceViewProps {
  snapshot: HardwareSnapshot;
  geoStatus: 'idle' | 'loading' | 'error' | 'ready';
  geoError: string | null;
  sensorsActive: boolean;
  onToggleSensors: () => void;
  onCaptureGeo: () => void;
  onClearGeo: () => void;
  profile: UserProfile;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
}

export const DeviceView: React.FC<DeviceViewProps> = ({
  snapshot,
  geoStatus,
  geoError,
  sensorsActive,
  onToggleSensors,
  onCaptureGeo,
  onClearGeo,
  profile,
  onUpdateProfile,
}) => {
  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-8 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-display">
              Motorola Edge 50 Pro — Hardware y sensores
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Lectura directa mediante APIs nativas del navegador para pantalla curva, energía, conectividad y orientación.
            </p>
          </div>
          <div className="sm:w-56 shrink-0">
            <PWAInstallButton />
          </div>
        </div>

        {/* Real Hardware Telemetry Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#101216] p-4 space-y-1">
            <p className="text-xs text-slate-400">Dispositivo detectado</p>
            <p className="text-base font-semibold text-white">{snapshot.deviceLabel}</p>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              {snapshot.viewport} · DPR {snapshot.pixelRatio}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#101216] p-4 space-y-1">
            <p className="text-xs text-slate-400">Batería del sistema</p>
            <p className="text-base font-semibold text-white font-mono tabular-nums">
              {snapshot.batteryLevel !== null
                ? `${Math.round(snapshot.batteryLevel * 100)}%`
                : 'No expuesta por navegador'}
            </p>
            <p className="text-xs text-slate-400">
              {snapshot.batteryCharging === null
                ? 'Requiere Android Chrome'
                : snapshot.batteryCharging
                ? 'Cargando'
                : 'Descargando'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#101216] p-4 space-y-1">
            <p className="text-xs text-slate-400">Conectividad de red</p>
            <p className="text-base font-semibold text-white font-mono tabular-nums">
              {snapshot.networkType ? snapshot.networkType.toUpperCase() : 'Estándar'}
            </p>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              {snapshot.downlinkMbps !== null
                ? `${snapshot.downlinkMbps} Mbps estimados`
                : 'Modo standalone: ' + (snapshot.isStandalonePwa ? 'Sí' : 'No')}
            </p>
          </div>
        </section>

        {/* Edge Ergonomics & Context Controls */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#101216] divide-y divide-white/[0.06]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">
                Márgenes seguros para pantalla curva pOLED
              </p>
              <p className="text-xs text-slate-400">
                Mantiene controles y texto alejados de los bordes curvos del Motorola Edge 50 Pro para evitar toques accidentales.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profile.curvedEdgeSafeMode}
              onClick={() =>
                onUpdateProfile({ curvedEdgeSafeMode: !profile.curvedEdgeSafeMode })
              }
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                profile.curvedEdgeSafeMode
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                  : 'border-white/10 bg-[#161920] text-slate-300'
              }`}
            >
              {profile.curvedEdgeSafeMode ? 'Activado' : 'Desactivado'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">
                Incluir contexto de hardware en consultas
              </p>
              <p className="text-xs text-slate-400">
                Comparte batería, red y ubicación (si la capturas) en el contexto local de la conversación.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profile.includeHardwareContext}
              onClick={() =>
                onUpdateProfile({ includeHardwareContext: !profile.includeHardwareContext })
              }
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                profile.includeHardwareContext
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                  : 'border-white/10 bg-[#161920] text-slate-300'
              }`}
            >
              {profile.includeHardwareContext ? 'Compartiendo en prompt' : 'Solo local'}
            </button>
          </div>
        </section>

        {/* Orientation & Geolocation Sensors */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#101216] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-semibold text-white">Giroscopio / Orientación</h2>
              </div>
              <button
                type="button"
                onClick={onToggleSensors}
                className="min-h-[44px] rounded-xl border border-white/10 bg-[#161920] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
              >
                {sensorsActive ? 'Pausar lectura' : 'Reanudar'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-center">
              <div className="rounded-xl bg-[#07080A] p-3 border border-white/[0.06]">
                <p className="text-[11px] text-slate-400">Alpha</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {snapshot.orientation.alpha !== null ? `${snapshot.orientation.alpha}°` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-[#07080A] p-3 border border-white/[0.06]">
                <p className="text-[11px] text-slate-400">Beta</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {snapshot.orientation.beta !== null ? `${snapshot.orientation.beta}°` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-[#07080A] p-3 border border-white/[0.06]">
                <p className="text-[11px] text-slate-400">Gamma</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {snapshot.orientation.gamma !== null ? `${snapshot.orientation.gamma}°` : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#101216] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-semibold text-white">Ubicación bajo demanda</h2>
              </div>
              <div className="flex items-center gap-2">
                {snapshot.geolocation && (
                  <button
                    type="button"
                    onClick={onClearGeo}
                    className="min-h-[44px] rounded-xl border border-white/10 bg-[#161920] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCaptureGeo}
                  disabled={geoStatus === 'loading'}
                  className="min-h-[44px] rounded-xl bg-sky-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 whitespace-nowrap"
                >
                  {geoStatus === 'loading' ? 'Obteniendo...' : 'Capturar GPS'}
                </button>
              </div>
            </div>

            {geoError ? (
              <p className="text-xs text-rose-300">{geoError}</p>
            ) : snapshot.geolocation ? (
              <div className="rounded-xl bg-[#07080A] p-3 border border-white/[0.06] font-mono tabular-nums text-xs text-slate-200 space-y-1">
                <p>
                  Lat: {snapshot.geolocation.latitude.toFixed(5)} · Lon:{' '}
                  {snapshot.geolocation.longitude.toFixed(5)}
                </p>
                <p className="text-slate-400">Precisión: ±{snapshot.geolocation.accuracyMeters} m</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Smartphone className="w-4 h-4 shrink-0 text-slate-500" />
                <span>Nunca se consulta tu GPS automáticamente; solo cuando pulsas Capturar GPS.</span>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
