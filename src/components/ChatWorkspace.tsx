import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Camera,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Mic,
  MicOff,
  RotateCcw,
  X,
} from 'lucide-react';
import type {
  ChatAttachment,
  ChatMessage,
  ChatSession,
  ThinkingDepth,
} from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CameraModal } from './CameraModal';

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface ChatWorkspaceProps {
  session: ChatSession;
  thinkingDepth: ThinkingDepth;
  onChangeThinkingDepth: (depth: ThinkingDepth) => void;
  webSearch: boolean;
  onToggleWebSearch: () => void;
  isStreaming: boolean;
  curvedEdgeSafeMode: boolean;
  onSendMessage: (text: string, attachment: ChatAttachment | null) => void;
  onRetryLast: () => void;
}

const STARTER_PROMPTS = [
  {
    title: 'Definición y contexto en vivo',
    prompt: '¿Qué significa comer?',
  },
  {
    title: 'Clima en tiempo real',
    prompt: '¿Cuál es el clima en Ciudad de México?',
  },
  {
    title: 'Investigación técnica web',
    prompt: 'Investiga Capacitor Android y pOLED 144Hz en smartphones.',
  },
  {
    title: 'Calibrar memoria personal',
    prompt: 'Recuerda que prefiero explicaciones técnicas directas y resúmenes en 3 puntos clave.',
  },
];

const DEPTH_LABELS: Record<ThinkingDepth, string> = {
  fast: 'Rápido',
  expert: 'Experto',
  deep: 'Profundo',
};

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  session,
  thinkingDepth,
  onChangeThinkingDepth,
  webSearch,
  onToggleWebSearch,
  isStreaming,
  curvedEdgeSafeMode,
  onSendMessage,
  onRetryLast,
}) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.messages.length, session.messages[session.messages.length - 1]?.content]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !attachment) || isStreaming) return;
    onSendMessage(trimmed, attachment);
    setInput('');
    setAttachment(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64Data = result.split(',')[1] || '';
      if (!base64Data) return;
      setAttachment({
        id: `att-${Date.now()}`,
        mimeType: file.type || 'image/jpeg',
        base64Data,
        previewUrl: result,
        label: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleVoiceInput = () => {
    if (!speechSupported) return;
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Rec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Rec) return;

    const recognition = new Rec();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const edgePadding = curvedEdgeSafeMode ? 'px-4 sm:px-6' : 'px-3 sm:px-6';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex-1 overflow-y-auto ${edgePadding} py-5`}>
        {session.messages.length === 0 ? (
          <div className="mx-auto flex max-w-3xl flex-col justify-center py-8 lg:py-16">
            <div className="space-y-3">
              <p className="text-xs font-medium tracking-wide text-sky-400">
                Asistente personal local-first
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
                Razonamiento directo, adaptado a ti.
              </h1>
              <p className="max-w-xl text-sm sm:text-base text-slate-400 leading-relaxed">
                Memoria persistente en tu dispositivo, síntesis web en tiempo real y captura visual optimizada para Motorola Edge 50 Pro.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => onSendMessage(item.prompt, null)}
                  className="group flex flex-col items-start gap-1.5 rounded-2xl border border-white/[0.08] bg-[#101216] p-4 text-left transition-colors hover:border-sky-500/40 hover:bg-[#161920] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <span className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
                    {item.title}
                  </span>
                  <span className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 pb-4">
            {session.messages.map((msg: ChatMessage, index: number) => {
              const isUser = msg.role === 'user';
              const isLast = index === session.messages.length - 1;
              return (
                <article
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  {isUser ? (
                    <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl border border-white/10 bg-[#161920] px-4 py-3 text-[15px] leading-relaxed text-slate-100">
                      {msg.attachmentPreview && (
                        <div className="mb-2.5 overflow-hidden rounded-xl border border-white/10">
                          <img
                            src={msg.attachmentPreview}
                            alt={msg.attachmentLabel || 'Imagen adjunta'}
                            className="max-h-60 w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="w-full space-y-3 border-b border-white/[0.06] pb-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-slate-200">Nexus Edge</span>
                        {msg.thinkingDepth && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{DEPTH_LABELS[msg.thinkingDepth]}</span>
                          </>
                        )}
                        {msg.webGrounded && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Web en vivo</span>
                          </>
                        )}
                        {typeof msg.latencyMs === 'number' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{msg.latencyMs}ms</span>
                          </>
                        )}
                      </div>

                      {msg.error ? (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-3">
                          <p className="text-sm text-rose-200">{msg.error}</p>
                          {isLast && (
                            <button
                              type="button"
                              onClick={onRetryLast}
                              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-100 hover:bg-rose-500/20 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reintentar consulta</span>
                            </button>
                          )}
                        </div>
                      ) : msg.content ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <p className="text-sm text-slate-400">Procesando razonamiento...</p>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-2 space-y-1.5">
                          <p className="text-xs font-medium text-slate-400">Fuentes consultadas</p>
                          <ul className="flex flex-col gap-1">
                            {msg.sources.slice(0, 6).map((src) => (
                              <li key={src.uri}>
                                <a
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 underline decoration-sky-400/30 underline-offset-2"
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[280px] sm:max-w-lg">{src.title}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {msg.learnedNotes && msg.learnedNotes.length > 0 && (
                        <div className="pt-1 text-xs text-emerald-300/90">
                          Aprendido en memoria local: {msg.learnedNotes.join(' · ')}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            <div ref={scrollEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className={`shrink-0 border-t border-white/[0.08] bg-[#07080A] ${edgePadding} py-3`}>
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-2.5">
          {attachment && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#101216] p-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={attachment.previewUrl}
                  alt={attachment.label}
                  className="h-12 w-12 rounded-lg object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
                <span className="truncate text-xs text-slate-300">{attachment.label}</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Quitar imagen adjunta"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-[#101216] p-2 focus-within:border-sky-500/50 transition-colors">
            <label htmlFor="nexus-prompt-input" className="sr-only">
              Escribe tu consulta para Nexus Edge
            </label>
            <textarea
              id="nexus-prompt-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe una consulta, pega una URL o adjunta una foto..."
              className="w-full min-h-[44px] max-h-36 resize-none bg-transparent px-2.5 py-2 text-[15px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />

            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2 px-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center rounded-lg bg-[#07080A] p-0.5 border border-white/[0.06]">
                  {(['fast', 'expert', 'deep'] as ThinkingDepth[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onChangeThinkingDepth(mode)}
                      className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        thinkingDepth === mode
                          ? 'bg-[#1E293B] text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {DEPTH_LABELS[mode]}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onToggleWebSearch}
                  aria-pressed={webSearch}
                  className={`min-h-[40px] flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    webSearch
                      ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>Web</span>
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  aria-label="Abrir cámara"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Adjuntar imagen"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={handleFileAttach}
                  className="sr-only"
                />

                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    aria-label={listening ? 'Detener dictado por voz' : 'Dictar por voz'}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
                      listening
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isStreaming || (!input.trim() && !attachment)}
                  aria-label="Enviar mensaje"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(att) => setAttachment(att)}
      />
    </div>
  );
};
