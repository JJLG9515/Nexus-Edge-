import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdaptiveSystemPrompt,
  createSeedMemories,
  DEFAULT_PROFILE,
  extractUrlsFromText,
  mergeLearnedMemories,
  parseVaultImport,
  serializeVault,
} from './memoryEngine';
import type { ChatSession, HardwareSnapshot } from '../types';

test('mergeLearnedMemories deduplicates similar memories and increments reinforcements', () => {
  const initial = createSeedMemories(1000);
  const firstMerge = mergeLearnedMemories(
    initial,
    [
      {
        category: 'preference',
        content: 'Prefiere ejemplos de código en TypeScript estricto sin librerías innecesarias.',
        confidence: 0.9,
      },
    ],
    2000
  );

  assert.equal(firstMerge.memories.length, 3);
  assert.equal(firstMerge.addedOrUpdated.length, 1);
  assert.equal(firstMerge.addedOrUpdated[0].reinforcements, 1);

  const secondMerge = mergeLearnedMemories(
    firstMerge.memories,
    [
      {
        category: 'preference',
        content: 'Prefiere ejemplos en TypeScript estricto sin librerias innecesarias',
        confidence: 0.95,
      },
    ],
    3000
  );

  assert.equal(secondMerge.memories.length, 3);
  const matched = secondMerge.memories.find((m) => m.category === 'preference');
  assert.ok(matched);
  assert.equal(matched.reinforcements, 2);
  assert.equal(matched.confidence, 0.95);
});

test('buildAdaptiveSystemPrompt includes active memories and optional hardware snapshot', () => {
  const memories = createSeedMemories(1000);
  memories.push({
    id: 'm-goal',
    category: 'goal',
    content: 'Construir sistemas distribuidos resilientes.',
    confidence: 0.9,
    reinforcements: 1,
    active: true,
    source: 'manual',
    createdAt: 1000,
    updatedAt: 1000,
  });

  const hardware: HardwareSnapshot = {
    deviceLabel: 'Motorola Edge 50 Pro',
    viewport: '412x915',
    pixelRatio: 2.625,
    isStandalonePwa: true,
    batteryLevel: 0.84,
    batteryCharging: false,
    networkType: '5g',
    downlinkMbps: 120,
    orientation: { alpha: 10, beta: 20, gamma: 0 },
    geolocation: null,
  };

  const promptWithHw = buildAdaptiveSystemPrompt(
    { ...DEFAULT_PROFILE, ownerName: 'Jesús', includeHardwareContext: true },
    memories,
    hardware
  );

  assert.match(promptWithHw, /Jesús/);
  assert.match(promptWithHw, /Construir sistemas distribuidos resilientes/);
  assert.match(promptWithHw, /Batería: 84%/);

  const promptWithoutHw = buildAdaptiveSystemPrompt(
    { ...DEFAULT_PROFILE, includeHardwareContext: false },
    memories,
    hardware
  );
  assert.doesNotMatch(promptWithoutHw, /Batería: 84%/);
});

test('extractUrlsFromText extracts unique clean URLs', () => {
  const urls = extractUrlsFromText(
    'Compara https://example.com/a, y https://example.com/b. También mira https://example.com/a'
  );
  assert.deepEqual(urls, ['https://example.com/a', 'https://example.com/b']);
});

test('serializeVault and parseVaultImport roundtrip cleanly and reject invalid schemas', () => {
  const memories = createSeedMemories(1000);
  const sessions: ChatSession[] = [
    {
      id: 's-1',
      title: 'Arquitectura local',
      createdAt: 1000,
      updatedAt: 1200,
      messages: [],
    },
  ];

  const json = serializeVault(sessions, memories, DEFAULT_PROFILE, 5000);
  const parsed = parseVaultImport(json);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.memories.length, memories.length);
  assert.equal(parsed.sessions[0].title, 'Arquitectura local');

  assert.throws(() => parseVaultImport('{"schemaVersion":99}'), /incompatible/i);
});
