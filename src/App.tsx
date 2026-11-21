import React, { useCallback, useMemo, useState } from 'react';
import {
  Brain,
  MessageSquare,
  Plus,
  Shield,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type {
  AppTab,
  ChatAttachment,
  ChatMessage,
  ChatSession,
  GroundingSource,
  MemoryCategory,
  MemoryItem,
  ThinkingDepth,
  UserProfile,
  VaultExport,
} from './types';
import {
  createSeedMemories,
  DEFAULT_PROFILE,
  mergeLearnedMemories,
} from './utils/memoryEngine';
import { runWebResearch } from './utils/webResearcher';
import { extractLocalInsights } from './utils/localLearner';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { useDeviceHardware } from './hooks/useDeviceHardware';
import { ChatWorkspace } from './components/ChatWorkspace';
import { MemoryView } from './components/MemoryView';
import { DeviceView } from './components/DeviceView';
import { VaultView } from './components/VaultView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

function createEmptySession(now = Date.now()): ChatSession {
  return {
    id: `sess-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'Nueva sesión',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('chat');
  const [profile, setProfile] = useLocalStorageState<UserProfile>(
    'nexus_edge_profile_v1',
    DEFAULT_PROFILE
  );
  const [memories, setMemories] = useLocalStorageState<MemoryItem[]>(
    'nexus_edge_memories_v1',
    () => createSeedMemories()
  );
  const [sessions, setSessions] = useLocalStorageState<ChatSession[]>(
    'nexus_edge_sessions_v1',
    () => [createEmptySession()]
  );
  const [activeSessionId, setActiveSessionId] = useLocalStorageState<string>(
    'nexus_edge_active_session_v1',
    () => sessions[0]?.id || ''
  );

  const [thinkingDepth, setThinkingDepth] = useState<ThinkingDepth>('expert');
  const [webSearch, setWebSearch] = useState<boolean>(profile.webSearchDefault);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const {
    snapshot,
    geoStatus,
    geoError,
    sensorsActive,
    setSensorsActive,
    captureGeolocation,
    clearGeolocation,
  } = useDeviceHardware();

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? createEmptySession();
  }, [sessions, activeSessionId]);

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      setProfile((prev) => ({ ...prev, ...patch }));
    },
    [setProfile]
  );

  const handleNewSession = useCallback(() => {
    const fresh = createEmptySession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setActiveTab('chat');
  }, [setSessions, setActiveSessionId]);

  const handleDeleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== id);
        if (remaining.length === 0) {
          const fresh = createEmptySession();
          setActiveSessionId(fresh.id);
          return [fresh];
        }
        if (id === activeSession.id) {
          setActiveSessionId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeSession.id, setSessions, setActiveSessionId]
  );

  const handleAddMemory = useCallback(
    (category: MemoryCategory, content: string) => {
      const now = Date.now();
      setMemories((prev) => [
        {
          id: `mem-${now}-${Math.random().toString(36).slice(2, 7)}`,
          category,
          content,
          confidence: 1,
          reinforcements: 1,
          active: true,
          source: 'manual',
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
    },
    [setMemories]
  );

  const handleToggleMemory = useCallback(
    (id: string) => {
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, active: !m.active, updatedAt: Date.now() } : m))
      );
    },
    [setMemories]
  );

  const handleDeleteMemory = useCallback(
    (id: string) => {
      setMemories((prev) => prev.filter((m) => m.id !== id));
    },
    [setMemories]
  );

  const runAutonomousLearning = useCallback(
    async (sessionId: string, assistantMsgId: string, userText: string) => {
      if (!profile.autoLearn || !userText.trim()) return;
      try {
        let insights = extractLocalInsights(
          userText,
          memories.slice(0, 20).map((m) => ({
            category: m.category,
            content: m.content,
          }))
        );

        if (insights.length === 0) {
          try {
            const res = await fetch('/api/learn', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userMessage: userText,
                existingMemories: memories.slice(0, 20).map((m) => ({
                  category: m.category,
                  content: m.content,
                })),
              }),
            });
            if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
              const data = (await res.json()) as {
                insights?: Array<{ category: MemoryCategory; content: string; confidence: number }>;
              };
              insights = data.insights ?? [];
            }
          } catch {
            // Local extraction already handled offline/standalone mode
          }
        }

        if (insights.length === 0) return;

        let learnedLabels: string[] = [];
        setMemories((prev) => {
          const merged = mergeLearnedMemories(prev, insights);
          learnedLabels = merged.addedOrUpdated.map((item) => item.content);
          return merged.memories;
        });

        if (learnedLabels.length > 0) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id !== sessionId
                ? s
                : {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantMsgId ? { ...m, learnedNotes: learnedLabels } : m
                    ),
                  }
            )
          );
        }
      } catch {
        // Ignore learning error cleanly
      }
    },
    [profile.autoLearn, memories, setMemories, setSessions]
  );

  const sendMessage = useCallback(
    async (text: string, attachment: ChatAttachment | null) => {
      if (isStreaming) return;

      const targetSessionId = activeSession.id;
      const now = Date.now();
      const userMsg: ChatMessage = {
        id: `msg-u-${now}`,
        role: 'user',
        content: text || 'Analiza esta imagen.',
        timestamp: now,
        attachmentPreview: attachment?.previewUrl,
        attachmentLabel: attachment?.label,
      };
      const assistantMsgId = `msg-a-${now + 1}`;
      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: now + 1,
        thinkingDepth,
        webGrounded: webSearch,
      };

      const priorHistory = activeSession.messages
        .filter((m) => !m.error && m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      setSessions((prev) => {
        const exists = prev.some((s) => s.id === targetSessionId);
        const baseList = exists ? prev : [activeSession, ...prev];
        return baseList.map((s) => {
          if (s.id !== targetSessionId) return s;
          const nextTitle =
            s.messages.length === 0 && text
              ? text.slice(0, 46) + (text.length > 46 ? '…' : '')
              : s.title;
          return {
            ...s,
            title: nextTitle,
            updatedAt: now,
            messages: [...s.messages, userMsg, assistantPlaceholder],
          };
        });
      });

      setIsStreaming(true);
      const startedAt = performance.now();

      try {
        let accumulatedText = '';
        let finalSources: GroundingSource[] = [];
        let streamError: string | null = null;
        let usedServerStream = false;

        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text,
              history: priorHistory,
              profile,
              memories,
              thinkingDepth,
              webSearch,
              image: attachment
                ? { mimeType: attachment.mimeType, base64Data: attachment.base64Data }
                : null,
            }),
          });

          const contentType = response.headers.get('content-type') || '';
          if (response.ok && response.body && contentType.includes('text/event-stream')) {
            usedServerStream = true;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              const events = buffer.split('\n\n');
              buffer = events.pop() ?? '';

              for (const rawEvent of events) {
                const lines = rawEvent.split('\n');
                let eventName = 'message';
                let dataStr = '';
                for (const line of lines) {
                  if (line.startsWith('event: ')) eventName = line.slice(7).trim();
                  if (line.startsWith('data: ')) dataStr += line.slice(6);
                }
                if (!dataStr) continue;

                try {
                  const payload = JSON.parse(dataStr) as {
                    text?: string;
                    fullText?: string;
                    sources?: GroundingSource[];
                    message?: string;
                  };
                  if (eventName === 'chunk' && payload.text) {
                    accumulatedText += payload.text;
                    setSessions((prev) =>
                      prev.map((s) =>
                        s.id !== targetSessionId
                          ? s
                          : {
                              ...s,
                              messages: s.messages.map((m) =>
                                m.id === assistantMsgId ? { ...m, content: accumulatedText } : m
                              ),
                            }
                      )
                    );
                  } else if (eventName === 'done') {
                    if (typeof payload.fullText === 'string' && payload.fullText.length > 0) {
                      accumulatedText = payload.fullText;
                    }
                    if (Array.isArray(payload.sources)) {
                      finalSources = payload.sources;
                    }
                  } else if (eventName === 'error') {
                    streamError = payload.message || 'Error en la investigación web.';
                  }
                } catch {
                  // Ignore malformed partial SSE line
                }
              }
            }
          }
        } catch {
          // Backend server not reachable (e.g. standalone APK without server.url); fall back to client CORS live web research
        }

        if (!usedServerStream) {
          const clientResearch = await runWebResearch({
            query: text || 'Investigación web en vivo',
            depth: thinkingDepth,
            webEnabled: webSearch,
            profile,
            memories,
            allowDirectUrlFetch: false,
          });
          accumulatedText = clientResearch.markdown;
          finalSources = clientResearch.sources;
        }

        if (!streamError && !accumulatedText.trim()) {
          streamError = 'No se obtuvieron resultados para esta consulta.';
        }

        const latencyMs = Math.round(performance.now() - startedAt);
        setSessions((prev) =>
          prev.map((s) =>
            s.id !== targetSessionId
              ? s
              : {
                  ...s,
                  updatedAt: Date.now(),
                  messages: s.messages.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: accumulatedText,
                          sources: finalSources,
                          latencyMs,
                          error: streamError ?? undefined,
                        }
                      : m
                  ),
                }
          )
        );

        if (!streamError && accumulatedText) {
          void runAutonomousLearning(targetSessionId, assistantMsgId, text);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo conectar con el servidor local de Nexus Edge.';
        setSessions((prev) =>
          prev.map((s) =>
            s.id !== targetSessionId
              ? s
              : {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, error: message } : m
                  ),
                }
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [
      isStreaming,
      activeSession,
      thinkingDepth,
      webSearch,
      profile,
      memories,
      snapshot,
      setSessions,
      runAutonomousLearning,
    ]
  );

  const handleRetryLast = useCallback(() => {
    const msgs = activeSession.messages;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id !== activeSession.id
          ? s
          : { ...s, messages: s.messages.slice(0, -2) }
      )
    );
    void sendMessage(lastUser.content, null);
  }, [activeSession, setSessions, sendMessage]);

  const handleImportVault = useCallback(
    (vault: VaultExport) => {
      setProfile(vault.profile);
      setMemories(vault.memories);
      const nextSessions = vault.sessions.length > 0 ? vault.sessions : [createEmptySession()];
      setSessions(nextSessions);
      setActiveSessionId(nextSessions[0].id);
    },
    [setProfile, setMemories, setSessions, setActiveSessionId]
  );

  const handleClearSessions = useCallback(() => {
    const fresh = createEmptySession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  }, [setSessions, setActiveSessionId]);

  const handleResetAll = useCallback(() => {
    const fresh = createEmptySession();
    setProfile(DEFAULT_PROFILE);
    setMemories(createSeedMemories());
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  }, [setProfile, setMemories, setSessions, setActiveSessionId]);

  const navItems: Array<{ id: AppTab; label: string; shortLabel: string; icon: React.ReactNode }> = [
    {
      id: 'chat',
      label: 'Conversación',
      shortLabel: 'Chat',
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      id: 'memory',
      label: 'Memoria',
      shortLabel: 'Memoria',
      icon: <Brain className="w-5 h-5" />,
    },
    {
      id: 'device',
      label: 'Dispositivo',
      shortLabel: 'Equipo',
      icon: <Smartphone className="w-5 h-5" />,
    },
    {
      id: 'vault',
      label: 'Bóveda',
      shortLabel: 'Bóveda',
      icon: <Shield className="w-5 h-5" />,
    },
  ];

  const activeMemoriesCount = memories.filter((m) => m.active).length;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#07080A] text-[#E8ECEF]">
      {/* Top Bar: 3-zone contract on desktop, safe-area aware compact bar on mobile */}
      <header className="min-h-14 pt-[env(safe-area-inset-top)] shrink-0 border-b border-white/[0.08] bg-[#07080A]/95 backdrop-blur-md px-4 lg:px-6 py-1.5 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('chat');
          }}
          className="text-base lg:text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          Nexus Edge
        </a>

        <nav
          aria-label="Navegación principal"
          className="hidden lg:flex items-center gap-6 text-sm font-medium"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] px-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === item.id
                  ? 'text-white underline decoration-sky-400 decoration-2 underline-offset-8'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleNewSession}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Nueva sesión</span>
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Left Sidebar */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-white/[0.08] bg-[#0A0C0F]">
          <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Historial local</span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {sessions.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.map((sess) => {
              const isCurrent = sess.id === activeSession.id && activeTab === 'chat';
              return (
                <div
                  key={sess.id}
                  className={`group flex items-center justify-between gap-1 rounded-xl px-2.5 py-1.5 transition-colors ${
                    isCurrent ? 'bg-[#161920] text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSessionId(sess.id);
                      setActiveTab('chat');
                    }}
                    className="flex-1 min-w-0 min-h-[40px] text-left text-xs font-medium truncate"
                  >
                    {sess.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(sess.id)}
                    aria-label={`Eliminar sesión ${sess.title}`}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-rose-300 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/[0.08] p-4 space-y-3">
            <div className="text-xs text-slate-400 space-y-1">
              <p className="font-medium text-slate-200">{profile.ownerName}</p>
              <p className="font-mono tabular-nums">
                {activeMemoriesCount} memorias activas · {snapshot.deviceLabel}
              </p>
            </div>
            <PWAInstallButton />
          </div>
        </aside>

        {/* Center Active Workspace */}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden bg-[#07080A]">
          {activeTab === 'chat' && (
            <ChatWorkspace
              session={activeSession}
              thinkingDepth={thinkingDepth}
              onChangeThinkingDepth={setThinkingDepth}
              webSearch={webSearch}
              onToggleWebSearch={() => setWebSearch((w) => !w)}
              isStreaming={isStreaming}
              curvedEdgeSafeMode={profile.curvedEdgeSafeMode}
              onSendMessage={sendMessage}
              onRetryLast={handleRetryLast}
            />
          )}

          {activeTab === 'memory' && (
            <MemoryView
              profile={profile}
              onUpdateProfile={updateProfile}
              memories={memories}
              onAddMemory={handleAddMemory}
              onToggleMemory={handleToggleMemory}
              onDeleteMemory={handleDeleteMemory}
            />
          )}

          {activeTab === 'device' && (
            <DeviceView
              snapshot={snapshot}
              geoStatus={geoStatus}
              geoError={geoError}
              sensorsActive={sensorsActive}
              onToggleSensors={() => setSensorsActive((a) => !a)}
              onCaptureGeo={captureGeolocation}
              onClearGeo={clearGeolocation}
              profile={profile}
              onUpdateProfile={updateProfile}
            />
          )}

          {activeTab === 'vault' && (
            <VaultView
              sessions={sessions}
              memories={memories}
              profile={profile}
              onImportVault={handleImportVault}
              onClearSessions={handleClearSessions}
              onResetAll={handleResetAll}
            />
          )}
        </main>

        {/* Desktop Right Context Inspector */}
        {activeTab === 'chat' && (
          <aside className="hidden xl:flex w-72 shrink-0 flex-col border-l border-white/[0.08] bg-[#0A0C0F] p-4 space-y-6 overflow-y-auto">
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-slate-300">Contexto activo</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Personalidad {profile.toneMode === 'direct' ? 'directa' : profile.toneMode === 'analytical' ? 'analítica' : 'creativa'} · Aprendizaje {profile.autoLearn ? 'activo' : 'pausado'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-300">Memorias aplicadas</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('memory')}
                  className="text-xs text-sky-400 hover:text-sky-300"
                >
                  Gestionar
                </button>
              </div>
              <ul className="space-y-2">
                {memories
                  .filter((m) => m.active)
                  .slice(0, 6)
                  .map((m) => (
                    <li
                      key={m.id}
                      className="rounded-xl border border-white/[0.06] bg-[#101216] p-2.5 text-xs text-slate-300 leading-relaxed"
                    >
                      {m.content}
                    </li>
                  ))}
              </ul>
            </div>

            <div className="space-y-2 border-t border-white/[0.06] pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-300">Hardware Edge</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('device')}
                  className="text-xs text-sky-400 hover:text-sky-300"
                >
                  Sensores
                </button>
              </div>
              <div className="text-xs text-slate-400 space-y-1 font-mono tabular-nums">
                <p>{snapshot.deviceLabel}</p>
                <p>Viewport {snapshot.viewport}</p>
                <p>
                  Batería:{' '}
                  {snapshot.batteryLevel !== null
                    ? `${Math.round(snapshot.batteryLevel * 100)}%`
                    : 'N/D'}
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Mobile Bottom Thumb-Zone Navigation (Motorola Edge 50 Pro ergonomics) */}
      <nav
        aria-label="Navegación móvil"
        className="lg:hidden h-14 shrink-0 border-t border-white/[0.08] bg-[#0A0C0F]/95 backdrop-blur-md pb-safe"
      >
        <div className="grid h-full grid-cols-4 items-center">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.icon}
                <span className="text-[11px] font-medium tracking-tight">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <OfflineIndicator />
    </div>
  );
}
