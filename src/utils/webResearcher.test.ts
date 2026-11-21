import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSearchQuery,
  rankRelevantExcerpts,
  runWebResearch,
  stripHtmlToCleanText,
  synthesizeResearchMarkdown,
} from './webResearcher';
import { DEFAULT_PROFILE } from './memoryEngine';
import { extractLocalInsights } from './localLearner';

test('normalizeSearchQuery detects definition, weather, tech, and URL intents accurately', () => {
  const def = normalizeSearchQuery('Que significa comer');
  assert.equal(def.intent, 'definition');
  assert.equal(def.targetWord, 'comer');

  const weather = normalizeSearchQuery('¿Cuál es el clima en Guadalajara?');
  assert.equal(weather.intent, 'weather');
  assert.equal(weather.location, 'Guadalajara');

  const tech = normalizeSearchQuery('Cómo compilar Capacitor Android en UserLAnd');
  assert.equal(tech.intent, 'tech');

  const withUrl = normalizeSearchQuery('Resume https://example.com/articulo sobre pOLED');
  assert.deepEqual(withUrl.urls, ['https://example.com/articulo']);
});

test('stripHtmlToCleanText removes scripts/styles and extracts title and clean paragraphs', () => {
  const html = `
    <html>
      <head><title>Motorola &amp; Edge 50 Pro</title><style>body{color:#000}</style></head>
      <body>
        <nav>Inicio Contacto</nav>
        <p>El Motorola Edge 50 Pro incorpora una pantalla pOLED curva de 144Hz con calibración Pantone.</p>
        <script>console.log("ignore")</script>
        <p>Corto</p>
      </body>
    </html>
  `;
  const parsed = stripHtmlToCleanText(html);
  assert.equal(parsed.title, 'Motorola & Edge 50 Pro');
  assert.equal(parsed.paragraphs.length, 1);
  assert.match(parsed.paragraphs[0], /pantalla pOLED curva de 144Hz/);
});

test('rankRelevantExcerpts prioritizes passages matching query terms', () => {
  const excerpts = rankRelevantExcerpts(
    'pantalla pOLED 144Hz bateria',
    [
      'La caja incluye funda protectora estándar y cable USB.',
      'La pantalla pOLED de 144Hz ofrece gran fluidez junto con una batería de carga rápida de 125W.',
      'Disponible en varios colores mate.',
    ],
    2
  );
  assert.match(excerpts[0], /pantalla pOLED de 144Hz/);
});

test('synthesizeResearchMarkdown formats concise and analytical output with sources', () => {
  const md = synthesizeResearchMarkdown({
    query: 'comer',
    intent: 'definition',
    findings: [
      {
        sourceTitle: 'Definición de "comer" — Wikcionario',
        sourceUrl: 'https://es.wiktionary.org/wiki/comer',
        origin: 'Wikcionario ES',
        excerpts: ['Ingerir alimentos sólidos por la boca para nutrirse.'],
      },
    ],
    toneMode: 'direct',
    verbosity: 'concise',
    activeMemories: [],
  });
  assert.match(md, /Ingerir alimentos sólidos/);
});

test('extractLocalInsights captures explicit memory requests and style preferences without API keys', () => {
  const insights = extractLocalInsights(
    'Recuerda que prefiero explicaciones técnicas directas y resúmenes en 3 puntos clave.',
    []
  );
  assert.equal(insights.length, 1);
  assert.equal(insights[0].category, 'style');
  assert.match(insights[0].content, /Prefiero explicaciones técnicas directas/);
});

test('runWebResearch confirms explicit memory commands directly without false web-not-found', async () => {
  const res = await runWebResearch({
    query: 'Recuerda que prefiero arquitectura local sin APIs',
    depth: 'expert',
    webEnabled: true,
    profile: DEFAULT_PROFILE,
    memories: [],
  });
  assert.match(res.markdown, /Guardado en tu memoria local/);
  assert.equal(res.sources.length, 0);
});
