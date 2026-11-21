import React, { useRef, useState } from 'react';
import { Download, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import type { ChatSession, MemoryItem, UserProfile, VaultExport } from '../types';
import { parseVaultImport, serializeVault } from '../utils/memoryEngine';

interface VaultViewProps {
  sessions: ChatSession[];
  memories: MemoryItem[];
  profile: UserProfile;
  onImportVault: (vault: VaultExport) => void;
  onClearSessions: () => void;
  onResetAll: () => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  sessions,
  memories,
  profile,
  onImportVault,
  onClearSessions,
  onResetAll,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);
  const estimatedBytes = new Blob([serializeVault(sessions, memories, profile)]).size;
  const estimatedKb = (estimatedBytes / 1024).toFixed(1);

  const handleExport = () => {
    const json = serializeVault(sessions, memories, profile);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-edge-boveda-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setErrorMsg(null);
    setStatusMsg('Bóveda exportada en formato JSON.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const parsed = parseVaultImport(text);
        onImportVault(parsed);
        setErrorMsg(null);
        setStatusMsg(
          `Bóveda restaurada: ${parsed.sessions.length} sesiones y ${parsed.memories.length} memorias.`
        );
      } catch (err: unknown) {
        setStatusMsg(null);
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo importar el archivo.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-8 pb-8">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">
            Bóveda local y soberanía de datos
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Tu historial, perfil y memoria residen exclusivamente en el almacenamiento local de tu dispositivo, sin inicio de sesión de Google ni bases de datos de terceros.
          </p>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono tabular-nums">
          <div className="rounded-2xl border border-white/[0.08] bg-[#101216] p-4">
            <p className="text-xs font-sans text-slate-400">Sesiones guardadas</p>
            <p className="mt-1 text-2xl font-bold text-white">{sessions.length}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#101216] p-4">
            <p className="text-xs font-sans text-slate-400">Mensajes locales</p>
            <p className="mt-1 text-2xl font-bold text-white">{totalMessages}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#101216] p-4">
            <p className="text-xs font-sans text-slate-400">Tamaño en dispositivo</p>
            <p className="mt-1 text-2xl font-bold text-white">{estimatedKb} KB</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#101216] p-5 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white font-display">
                Arquitectura de privacidad y límites operativos
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tus conversaciones, preferencias y memoria residen únicamente en el almacenamiento local del dispositivo, sin cuentas externas ni claves de API requeridas. La investigación en tiempo real consulta fuentes web abiertas y, si ejecutas Ollama localmente en UserLAnd, puede sintetizar las respuestas en tu propio hardware.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#101216] p-5 space-y-4">
          <h2 className="text-base font-semibold text-white font-display">
            Respaldo portátil (Exportar / Importar)
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Exportar bóveda JSON</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#161920] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              <span>Importar respaldo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleImportFile}
              className="sr-only"
            />
          </div>

          {statusMsg && <p className="text-xs text-emerald-300">{statusMsg}</p>}
          {errorMsg && <p className="text-xs text-rose-300">{errorMsg}</p>}
        </section>

        <section className="rounded-2xl border border-rose-500/20 bg-[#101216] p-5 space-y-4">
          <h2 className="text-base font-semibold text-white font-display">
            Limpieza local
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onClearSessions();
                setStatusMsg('Historial de conversaciones borrado.');
              }}
              className="min-h-[44px] rounded-xl border border-white/10 bg-[#161920] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
            >
              Borrar solo historial de chats
            </button>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restablecer bóveda completa</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetAll();
                    setConfirmReset(false);
                    setStatusMsg('Bóveda local restablecida.');
                  }}
                  className="min-h-[44px] rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition-colors"
                >
                  Confirmar borrado total
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[44px] rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
