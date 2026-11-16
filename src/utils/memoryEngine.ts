import type {
  ChatSession,
  HardwareSnapshot,
  MemoryCategory,
  MemoryItem,
  UserProfile,
  VaultExport,
} from '../types';

export const DEFAULT_PROFILE: UserProfile = {
  ownerName: 'Propietario',
  toneMode: 'direct',
  verbosity: 'balanced',
  autoLearn: true,
  webSearchDefault: true,
  includeHardwareContext: false,
  curvedEdgeSafeMode: true,
};

export function createSeedMemories(now = Date.now()): MemoryItem[] {
  return [
    {
      id: 'mem-seed-device',
      category: 'fact',
      content: 'Dispositivo principal: Motorola Edge 50 Pro (pantalla pOLED curva 20:9).',
      confidence: 1,
      reinforcements: 1,
      active: true,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem-seed-style',
      category: 'style',
      content: 'Respuestas directas, precisas y sin introducciones ni adornos innecesarios.',
      confidence: 1,
      reinforcements: 1,
      active: true,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function normalizeMemoryText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlapRatio(a: string, b: string): number {
  const wordsA = new Set(normalizeMemoryText(a).split(' ').filter((w) => w.length > 2));
  const wordsB = new Set(normalizeMemoryText(b).split(' ').filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared += 1;
  }
  return shared / Math.min(wordsA.size, wordsB.size);
}

export interface IncomingMemoryCandidate {
  category: MemoryCategory;
  content: string;
  confidence?: number;
}

export function mergeLearnedMemories(
  existing: MemoryItem[],
  incoming: IncomingMemoryCandidate[],
  now = Date.now(),
  maxItems = 80
): { memories: MemoryItem[]; addedOrUpdated: MemoryItem[] } {
  const next = existing.map((item) => ({ ...item }));
  const addedOrUpdated: MemoryItem[] = [];

  for (const candidate of incoming) {
    const cleaned = candidate.content.trim();
    if (cleaned.length < 6) continue;

    const normalizedCandidate = normalizeMemoryText(cleaned);
    const matchIdx = next.findIndex((item) => {
      if (item.category !== candidate.category) return false;
      const normExisting = normalizeMemoryText(item.content);
      if (normExisting === normalizedCandidate) return true;
      return tokenOverlapRatio(item.content, cleaned) >= 0.72;
    });

    const conf = Math.min(1, Math.max(0.4, candidate.confidence ?? 0.85));

    if (matchIdx >= 0) {
      const current = next[matchIdx];
      const updated: MemoryItem = {
        ...current,
        content: cleaned.length >= current.content.length ? cleaned : current.content,
        confidence: Math.min(1, Math.max(current.confidence, conf)),
        reinforcements: current.reinforcements + 1,
        updatedAt: now,
      };
      next[matchIdx] = updated;
      addedOrUpdated.push(updated);
    } else {
      const created: MemoryItem = {
        id: `mem-${now}-${Math.random().toString(36).slice(2, 8)}`,
        category: candidate.category,
        content: cleaned,
        confidence: conf,
        reinforcements: 1,
        active: true,
        source: 'auto',
        createdAt: now,
        updatedAt: now,
      };
      next.unshift(created);
      addedOrUpdated.push(created);
    }
  }

  // Keep most recently updated / reinforced items within budget
  const sorted = next.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  return {
    memories: sorted.slice(0, maxItems),
    addedOrUpdated,
  };
}

export function buildAdaptiveSystemPrompt(
  profile: UserProfile,
  memories: MemoryItem[],
  hardware?: HardwareSnapshot | null
): string {
  const toneGuide: Record<UserProfile['toneMode'], string> = {
    direct: 'Sé directo, claro y eficiente. Elimina saludos largos, preámbulos y relleno.',
    analytical: 'Prioriza rigor técnico, estructura lógica, evidencia y contraste entre enfoques.',
    creative: 'Combina profundidad técnica con síntesis original y conexiones interdisciplinarias.',
  };

  const verbosityGuide: Record<UserProfile['verbosity'], string> = {
    concise: 'Mantén las respuestas breves, accionables y densas en información.',
    balanced: 'Ajusta la extensión a la complejidad real de la consulta sin redundancias.',
    exhaustive: 'Desarrolla análisis profundos, paso a paso, con casos borde y detalles expertos.',
  };

  const activeMemories = memories.filter((m) => m.active);
  const grouped: Record<MemoryCategory, string[]> = {
    style: [],
    preference: [],
    goal: [],
    fact: [],
  };

  for (const mem of activeMemories.slice(0, 32)) {
    grouped[mem.category].push(`- ${mem.content}`);
  }

  const sections: string[] = [
    `Eres Nexus Edge, un asistente personal de alto razonamiento para ${profile.ownerName || 'el usuario'}.`,
    'Principios operativos:',
    `- ${toneGuide[profile.toneMode]}`,
    `- ${verbosityGuide[profile.verbosity]}`,
    '- Razona con nivel experto conectando múltiples disciplinas cuando aporte valor real.',
    '- Responde en el idioma del usuario (español por defecto) sin sermones ni condescendencia.',
    '- Cuando uses búsqueda web en tiempo real, sintetiza hechos verificables y cita fuentes concretas.',
  ];

  if (grouped.style.length > 0) {
    sections.push(`\nEstilo de comunicación preferido:\n${grouped.style.join('\n')}`);
  }
  if (grouped.preference.length > 0) {
    sections.push(`\nPreferencias aprendidas:\n${grouped.preference.join('\n')}`);
  }
  if (grouped.goal.length > 0) {
    sections.push(`\nObjetivos a largo plazo:\n${grouped.goal.join('\n')}`);
  }
  if (grouped.fact.length > 0) {
    sections.push(`\nContexto del usuario:\n${grouped.fact.join('\n')}`);
  }

  if (profile.includeHardwareContext && hardware) {
    const hwLines = [
      `Pantalla/Viewport: ${hardware.viewport} (DPR ${hardware.pixelRatio})`,
      `Modo PWA instalada: ${hardware.isStandalonePwa ? 'Sí' : 'No'}`,
    ];
    if (hardware.batteryLevel !== null) {
      hwLines.push(
        `Batería: ${Math.round(hardware.batteryLevel * 100)}%${hardware.batteryCharging ? ' (cargando)' : ''}`
      );
    }
    if (hardware.networkType) {
      hwLines.push(
        `Red: ${hardware.networkType}${hardware.downlinkMbps ? ` (${hardware.downlinkMbps} Mbps)` : ''}`
      );
    }
    if (hardware.geolocation) {
      hwLines.push(
        `Ubicación aproximada: ${hardware.geolocation.latitude.toFixed(4)}, ${hardware.geolocation.longitude.toFixed(4)}`
      );
    }
    sections.push(`\nContexto del dispositivo actual:\n- ${hwLines.join('\n- ')}`);
  }

  return sections.join('\n');
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>)"']+/gi) ?? [];
  const unique = Array.from(new Set(matches.map((u) => u.replace(/[.,;!?]+$/, ''))));
  return unique.slice(0, 20);
}

export function serializeVault(
  sessions: ChatSession[],
  memories: MemoryItem[],
  profile: UserProfile,
  now = Date.now()
): string {
  const payload: VaultExport = {
    schemaVersion: 1,
    exportedAt: now,
    profile,
    memories,
    sessions,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseVaultImport(rawJson: string): VaultExport {
  const parsed = JSON.parse(rawJson) as Partial<VaultExport>;
  if (!parsed || parsed.schemaVersion !== 1) {
    throw new Error('Formato de bóveda incompatible (se esperaba schemaVersion: 1).');
  }
  if (!parsed.profile || !Array.isArray(parsed.memories) || !Array.isArray(parsed.sessions)) {
    throw new Error('Archivo de bóveda incompleto: faltan perfil, memorias o sesiones.');
  }
  return {
    schemaVersion: 1,
    exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
    profile: { ...DEFAULT_PROFILE, ...parsed.profile },
    memories: parsed.memories,
    sessions: parsed.sessions,
  };
}
