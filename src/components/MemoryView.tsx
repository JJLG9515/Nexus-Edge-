import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { MemoryCategory, MemoryItem, ToneMode, UserProfile, VerbosityMode } from '../types';

interface MemoryViewProps {
  profile: UserProfile;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  memories: MemoryItem[];
  onAddMemory: (category: MemoryCategory, content: string) => void;
  onToggleMemory: (id: string) => void;
  onDeleteMemory: (id: string) => void;
}

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  style: 'Estilo',
  preference: 'Preferencia',
  goal: 'Objetivo',
  fact: 'Hecho',
};

export const MemoryView: React.FC<MemoryViewProps> = ({
  profile,
  onUpdateProfile,
  memories,
  onAddMemory,
  onToggleMemory,
  onDeleteMemory,
}) => {
  const [filter, setFilter] = useState<'all' | MemoryCategory>('all');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('preference');
  const [newContent, setNewContent] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newContent.trim();
    if (cleaned.length < 4) return;
    onAddMemory(newCategory, cleaned);
    setNewContent('');
  };

  const filtered = filter === 'all' ? memories : memories.filter((m) => m.category === filter);

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-8 pb-8">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">
            Memoria y aprendizaje continuo
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Nexus Edge guarda tu estilo, preferencias y objetivos localmente en este dispositivo para adaptarse sin cuentas externas.
          </p>
        </div>

        {/* Personality & Adaptation Profile */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#101216] p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-white font-display">
              Perfil de adaptación
            </h2>
            <button
              type="button"
              role="switch"
              aria-checked={profile.autoLearn}
              onClick={() => onUpdateProfile({ autoLearn: !profile.autoLearn })}
              className={`min-h-[44px] flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                profile.autoLearn
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                  : 'border-white/10 bg-[#161920] text-slate-400'
              }`}
            >
              <span>Aprendizaje autónomo: {profile.autoLearn ? 'Activo' : 'Pausado'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="owner-name-input" className="block text-xs font-medium text-slate-300">
                Nombre o alias
              </label>
              <input
                id="owner-name-input"
                type="text"
                value={profile.ownerName}
                onChange={(e) => onUpdateProfile({ ownerName: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#07080A] px-3.5 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tone-select" className="block text-xs font-medium text-slate-300">
                Personalidad base
              </label>
              <select
                id="tone-select"
                value={profile.toneMode}
                onChange={(e) => onUpdateProfile({ toneMode: e.target.value as ToneMode })}
                className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#07080A] px-3.5 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="direct">Directa y eficiente</option>
                <option value="analytical">Analítica y estructurada</option>
                <option value="creative">Creativa e interdisciplinaria</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="verbosity-select" className="block text-xs font-medium text-slate-300">
                Nivel de detalle
              </label>
              <select
                id="verbosity-select"
                value={profile.verbosity}
                onChange={(e) => onUpdateProfile({ verbosity: e.target.value as VerbosityMode })}
                className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#07080A] px-3.5 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="concise">Conciso</option>
                <option value="balanced">Equilibrado</option>
                <option value="exhaustive">Exhaustivo</option>
              </select>
            </div>
          </div>
        </section>

        {/* Manual Memory Form */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#101216] p-5 space-y-4">
          <h2 className="text-base font-semibold text-white font-display">
            Añadir instrucción o meta a largo plazo
          </h2>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="new-mem-cat" className="sr-only">
              Categoría de memoria
            </label>
            <select
              id="new-mem-cat"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
              className="min-h-[44px] rounded-xl border border-white/10 bg-[#07080A] px-3.5 py-2 text-sm text-white focus:border-sky-500 focus:outline-none sm:w-44 shrink-0"
            >
              <option value="preference">Preferencia</option>
              <option value="style">Estilo</option>
              <option value="goal">Objetivo</option>
              <option value="fact">Hecho</option>
            </select>

            <label htmlFor="new-mem-text" className="sr-only">
              Contenido de la memoria
            </label>
            <input
              id="new-mem-text"
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Ej. Priorizar arquitectura Rust y ejemplos prácticos sin relleno..."
              className="flex-1 min-h-[44px] rounded-xl border border-white/10 bg-[#07080A] px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={newContent.trim().length < 4}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar</span>
            </button>
          </form>
        </section>

        {/* Memory List */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white font-display">
              Memorias registradas ({memories.length})
            </h2>

            <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#101216] p-1">
              {(['all', 'style', 'preference', 'goal', 'fact'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filter === cat ? 'bg-[#1E293B] text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'Todas' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#101216] p-6 text-center text-sm text-slate-400">
              No hay elementos en esta categoría todavía.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#101216]">
              {filtered.map((mem) => (
                <div
                  key={mem.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div className="space-y-1 min-w-0">
                    <p
                      className={`text-sm leading-relaxed ${
                        mem.active ? 'text-slate-100' : 'text-slate-500 line-through'
                      }`}
                    >
                      {mem.content}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                      <span>{CATEGORY_LABELS[mem.category]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{mem.source === 'auto' ? 'Autoaprendido' : 'Manual'}</span>
                      <span aria-hidden="true">·</span>
                      <span>Refuerzos ×{mem.reinforcements}</span>
                      <span aria-hidden="true">·</span>
                      <span>{Math.round(mem.confidence * 100)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleMemory(mem.id)}
                      className="min-h-[44px] rounded-xl border border-white/10 bg-[#161920] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap"
                    >
                      {mem.active ? 'Activa' : 'Pausada'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMemory(mem.id)}
                      aria-label={`Eliminar memoria: ${mem.content}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 bg-[#161920] text-slate-400 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
