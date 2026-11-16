import { useCallback, useEffect, useState } from 'react';
import type { HardwareSnapshot } from '../types';

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

interface NavigatorWithDeviceApis extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    addEventListener?: (type: string, cb: () => void) => void;
    removeEventListener?: (type: string, cb: () => void) => void;
  };
}

function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Dispositivo web';
  const ua = navigator.userAgent;
  if (/motorola|moto|edge 50/i.test(ua)) return 'Motorola Edge (Android)';
  if (/android/i.test(ua)) return 'Android Mobile';
  if (/iphone|ipad/i.test(ua)) return 'iOS Mobile';
  return 'Estación Desktop';
}

export function useDeviceHardware() {
  const [snapshot, setSnapshot] = useState<HardwareSnapshot>(() => ({
    deviceLabel: detectDeviceLabel(),
    viewport:
      typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '0×0',
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    isStandalonePwa:
      typeof window !== 'undefined'
        ? window.matchMedia('(display-mode: standalone)').matches
        : false,
    batteryLevel: null,
    batteryCharging: null,
    networkType: null,
    downlinkMbps: null,
    orientation: { alpha: null, beta: null, gamma: null },
    geolocation: null,
  }));

  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [sensorsActive, setSensorsActive] = useState<boolean>(true);

  useEffect(() => {
    const updateViewport = () => {
      setSnapshot((prev) => ({
        ...prev,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
        pixelRatio: window.devicePixelRatio || 1,
        isStandalonePwa: window.matchMedia('(display-mode: standalone)').matches,
      }));
    };

    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const nav = navigator as NavigatorWithDeviceApis;
    let batteryRef: BatteryManagerLike | null = null;

    const updateBattery = () => {
      if (!batteryRef) return;
      setSnapshot((prev) => ({
        ...prev,
        batteryLevel: batteryRef ? batteryRef.level : null,
        batteryCharging: batteryRef ? batteryRef.charging : null,
      }));
    };

    if (typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((battery) => {
          batteryRef = battery;
          updateBattery();
          battery.addEventListener('levelchange', updateBattery);
          battery.addEventListener('chargingchange', updateBattery);
        })
        .catch(() => {
          // Battery API unsupported in this browser
        });
    }

    const updateNetwork = () => {
      if (!nav.connection) return;
      setSnapshot((prev) => ({
        ...prev,
        networkType: nav.connection?.effectiveType ?? null,
        downlinkMbps: typeof nav.connection?.downlink === 'number' ? nav.connection.downlink : null,
      }));
    };
    updateNetwork();
    nav.connection?.addEventListener?.('change', updateNetwork);

    return () => {
      batteryRef?.removeEventListener('levelchange', updateBattery);
      batteryRef?.removeEventListener('chargingchange', updateBattery);
      nav.connection?.removeEventListener?.('change', updateNetwork);
    };
  }, []);

  useEffect(() => {
    if (!sensorsActive) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null && e.beta === null && e.gamma === null) return;
      setSnapshot((prev) => ({
        ...prev,
        orientation: {
          alpha: e.alpha !== null ? Math.round(e.alpha) : null,
          beta: e.beta !== null ? Math.round(e.beta) : null,
          gamma: e.gamma !== null ? Math.round(e.gamma) : null,
        },
      }));
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [sensorsActive]);

  const captureGeolocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('error');
      setGeoError('Geolocalización no disponible en este navegador.');
      return;
    }

    setGeoStatus('loading');
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus('ready');
        setSnapshot((prev) => ({
          ...prev,
          geolocation: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: Math.round(pos.coords.accuracy),
            capturedAt: pos.timestamp,
          },
        }));
      },
      (err) => {
        setGeoStatus('error');
        setGeoError(err.message || 'Permiso de ubicación denegado.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const clearGeolocation = useCallback(() => {
    setGeoStatus('idle');
    setGeoError(null);
    setSnapshot((prev) => ({ ...prev, geolocation: null }));
  }, []);

  return {
    snapshot,
    geoStatus,
    geoError,
    sensorsActive,
    setSensorsActive,
    captureGeolocation,
    clearGeolocation,
  };
}
