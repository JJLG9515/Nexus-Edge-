import type {
  GroundingSource,
  MemoryItem,
  ThinkingDepth,
  ToneMode,
  UserProfile,
  VerbosityMode,
} from '../types.ts';
import { extractUrlsFromText } from './memoryEngine.ts';

export type ResearchIntent = 'definition' | 'weather' | 'tech' | 'academic' | 'general';

export interface ParsedQuery {
  cleanQuery: string;
  intent: ResearchIntent;
  targetWord?: string;
  location?: string;
  urls: string[];
}

export interface WebFinding {
  sourceTitle: string;
  sourceUrl: string;
  origin: string;
  excerpts: string[];
}

const STOP_WORDS = new Set([
  'que', 'qué', 'como', 'cómo', 'cual', 'cuál', 'cuales', 'cuáles', 'quien', 'quién',
  'donde', 'dónde', 'cuando', 'cuándo', 'para', 'por', 'con', 'sin', 'sobre', 'entre',
  'una', 'uno', 'unos', 'unas', 'los', 'las', 'del', 'al', 'el', 'la', 'lo', 'en', 'de',
  'y', 'o', 'es', 'son', 'fue', 'ser', 'estar', 'significa', 'significado', 'definicion',
  'definición', 'busca', 'buscar', 'investiga', 'dime', 'explica', 'explicame', 'explícame',
  'the', 'what', 'how', 'why', 'who', 'where', 'when', 'is', 'are', 'of', 'in', 'to', 'and',
]);

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

export function stripHtmlToCleanText(html: string): { title: string; paragraphs: string[] } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : '';

  const cleanedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|blockquote|article|section|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const plain = decodeHtmlEntities(cleanedHtml);
  const paragraphs = plain
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 35 && !/^cookie|privacy|copyright|men[uú]|iniciar sesi[oó]n/i.test(line));

  return { title, paragraphs: paragraphs.slice(0, 60) };
}

export function normalizeSearchQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  const urls = extractUrlsFromText(trimmed);
  const withoutUrls = trimmed.replace(/https?:\/\/[^\s]+/gi, '').trim();

  const defMatch = withoutUrls.match(
    /^(?:qu[eé]\s+significa|significado\s+de|definici[oó]n\s+de|qu[eé]\s+es)\s+(?:la\s+palabra\s+|el\s+t[eé]rmino\s+)?["¿?¡!]?([^?!."]+)[?!."]?$/i
  );
  if (defMatch?.[1]) {
    const targetWord = defMatch[1].trim();
    return {
      cleanQuery: targetWord,
      intent: 'definition',
      targetWord,
      urls,
    };
  }

  const weatherMatch = withoutUrls.match(
    /\b(?:clima|tiempo|temperatura|pron[oó]stico|lluvia)\s+(?:en|de|para)\s+([A-Za-zÀ-ÿ\s,-]{2,50})/i
  );
  if (weatherMatch?.[1]) {
    const location = weatherMatch[1].replace(/[?!.]+$/, '').trim();
    return {
      cleanQuery: withoutUrls,
      intent: 'weather',
      location,
      urls,
    };
  }

  const lower = withoutUrls.toLowerCase();
  if (
    /\b(c[oó]digo|error|typescript|javascript|react|vite|capacitor|android|gradle|linux|userland|python|rust|docker|api|npm|github|stack|algoritmo|arquitectura|sqlite|sql)\b/i.test(
      lower
    )
  ) {
    return { cleanQuery: withoutUrls || trimmed, intent: 'tech', urls };
  }

  if (
    /\b(estudio|paper|cient[ií]fic|arxiv|investigaci[oó]n|teorema|f[ií]sica|qu[ií]mica|biolog[ií]a|neurociencia|cu[aá]ntic|bater[ií]a|poled)\b/i.test(
      lower
    )
  ) {
    return { cleanQuery: withoutUrls || trimmed, intent: 'academic', urls };
  }

  const strippedLead = withoutUrls
    .replace(
      /^(?:busca|investiga|dime|explica|expl[ií]came|analiza|resume|compara|qu[eé]\s+es|qui[eé]n\s+es|c[oó]mo\s+funciona)\s+/i,
      ''
    )
    .replace(/[?!¿¡]+/g, '')
    .trim();

  return {
    cleanQuery: strippedLead || withoutUrls || trimmed,
    intent: 'general',
    urls,
  };
}

export function extractKeywords(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    )
  );
}

export function rankRelevantExcerpts(query: string, texts: string[], maxExcerpts = 4): string[] {
  const keywords = extractKeywords(query);
  const scored = texts
    .map((text, idx) => {
      const norm = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      let hits = 0;
      for (const kw of keywords) {
        if (norm.includes(kw)) hits += 1;
      }
      const positionBonus = idx < 3 ? 0.5 : 0;
      const lengthPenalty = text.length > 750 ? -0.5 : 0;
      return { text, score: hits + positionBonus + lengthPenalty, idx };
    })
    .filter((item) => item.text.trim().length > 25);

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));
  return scored.slice(0, maxExcerpts).map((item) => item.text.trim());
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchWikipedia(lang: 'es' | 'en', query: string, limit: number): Promise<WebFinding[]> {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&srlimit=${limit}&format=json&utf8=1&origin=*`;
  const searchData = await fetchJsonWithTimeout<{
    query?: { search?: Array<{ title: string; snippet?: string }> };
  }>(searchUrl);

  const titles = (searchData?.query?.search ?? []).map((item) => item.title).slice(0, limit);
  if (titles.length === 0) return [];

  const extractUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(
    titles.join('|')
  )}&format=json&utf8=1&origin=*`;
  const extractData = await fetchJsonWithTimeout<{
    query?: { pages?: Record<string, { title: string; extract?: string }> };
  }>(extractUrl);

  const pages = Object.values(extractData?.query?.pages ?? {});
  const findings: WebFinding[] = [];
  for (const page of pages) {
    const extract = page.extract?.trim();
    if (!extract) continue;
    const paragraphs = extract
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20)
      .slice(0, 3);
    if (paragraphs.length === 0) continue;
    findings.push({
      sourceTitle: `${page.title} — Wikipedia (${lang.toUpperCase()})`,
      sourceUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      origin: `Wikipedia ${lang.toUpperCase()}`,
      excerpts: paragraphs,
    });
  }
  return findings;
}

async function fetchWiktionary(word: string): Promise<WebFinding[]> {
  const cleanWord = word.toLowerCase().trim();
  const url = `https://es.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(
    cleanWord
  )}&format=json&utf8=1&origin=*`;
  const data = await fetchJsonWithTimeout<{
    query?: { pages?: Record<string, { pageid?: number; title: string; extract?: string }> };
  }>(url);

  const pages = Object.values(data?.query?.pages ?? {}).filter((p) => p.extract && p.pageid);
  if (pages.length === 0) return [];

  const findings: WebFinding[] = [];
  for (const page of pages) {
    const raw = page.extract || '';
    const spanishSection = raw.split(/\n==\s*(?!Español)/i)[0] || raw;
    const rawLines = spanishSection
      .split(/\n+/)
      .map((l) => l.replace(/^={2,}\s*|\s*={2,}$/g, '').trim())
      .filter(
        (l) =>
          l.length > 12 &&
          !/^(Español|Pronunciación|Traducciones|Sinónimos|Antónimos|Referencias|Véase también|Etimología)/i.test(
            l
          )
      );

    const defLines = rawLines.filter(
      (l) => !/^Se documenta por primera vez|^Del lat[ií]n\b|^De\s+\w+\s+y\s+el\s+sufijo/i.test(l)
    );
    const chosen = (defLines.length > 0 ? defLines : rawLines).slice(0, 6);

    if (chosen.length > 0) {
      findings.push({
        sourceTitle: `Definición de "${page.title}" — Wikcionario`,
        sourceUrl: `https://es.wiktionary.org/wiki/${encodeURIComponent(page.title)}`,
        origin: 'Wikcionario ES',
        excerpts: chosen,
      });
    }
  }
  return findings;
}

async function fetchWeather(location: string): Promise<WebFinding[]> {
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    location
  )}&count=1&language=es`;
  const geo = await fetchJsonWithTimeout<{
    results?: Array<{
      name: string;
      country?: string;
      admin1?: string;
      latitude: number;
      longitude: number;
    }>;
  }>(geoUrl);

  const place = geo?.results?.[0];
  if (!place) return [];

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`;
  const w = await fetchJsonWithTimeout<{
    current?: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      precipitation: number;
    };
    daily?: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
    };
  }>(weatherUrl);

  if (!w?.current) return [];
  const label = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
  const excerpts = [
    `Condiciones actuales en ${label}: ${w.current.temperature_2m}°C (sensación ${w.current.apparent_temperature}°C), humedad ${w.current.relative_humidity_2m}%, viento ${w.current.wind_speed_10m} km/h, precipitación ${w.current.precipitation} mm.`,
  ];

  if (w.daily?.time?.length) {
    const forecast = w.daily.time
      .map(
        (day, idx) =>
          `${day}: mín ${w.daily!.temperature_2m_min[idx]}°C / máx ${w.daily!.temperature_2m_max[idx]}°C (prob. lluvia ${w.daily!.precipitation_probability_max[idx]}%)`
      )
      .join(' | ');
    excerpts.push(`Pronóstico próximos días: ${forecast}`);
  }

  return [
    {
      sourceTitle: `Clima en vivo: ${label} — Open-Meteo`,
      sourceUrl: `https://open-meteo.com/`,
      origin: 'Open-Meteo',
      excerpts,
    },
  ];
}

async function fetchTechSources(query: string, limit: number): Promise<WebFinding[]> {
  const [soData, hnData, ghData] = await Promise.all([
    fetchJsonWithTimeout<{
      items?: Array<{ title: string; link: string; score: number; answer_count: number; is_answered: boolean }>;
    }>(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(
        query
      )}&site=stackoverflow&pagesize=${limit}`
    ),
    fetchJsonWithTimeout<{
      hits?: Array<{ title?: string; url?: string; objectID: string; points?: number; num_comments?: number }>;
    }>(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${limit}`),
    fetchJsonWithTimeout<{
      items?: Array<{ full_name: string; html_url: string; description?: string; stargazers_count: number }>;
    }>(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=${Math.min(
        limit,
        3
      )}`
    ),
  ]);

  const findings: WebFinding[] = [];
  for (const item of soData?.items ?? []) {
    findings.push({
      sourceTitle: `${decodeHtmlEntities(item.title)} — StackOverflow`,
      sourceUrl: item.link,
      origin: 'StackOverflow',
      excerpts: [
        `Pregunta técnica (${item.is_answered ? 'resuelta' : 'abierta'}, puntuación ${item.score}, ${item.answer_count} respuestas).`,
      ],
    });
  }
  for (const hit of hnData?.hits ?? []) {
    if (!hit.title) continue;
    const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
    findings.push({
      sourceTitle: `${hit.title} — Hacker News`,
      sourceUrl: url,
      origin: 'Hacker News',
      excerpts: [`Discusión técnica (${hit.points ?? 0} puntos, ${hit.num_comments ?? 0} comentarios).`],
    });
  }
  for (const repo of ghData?.items ?? []) {
    findings.push({
      sourceTitle: `${repo.full_name} — GitHub`,
      sourceUrl: repo.html_url,
      origin: 'GitHub',
      excerpts: [
        `${repo.description || 'Repositorio de código abierto'} (${repo.stargazers_count} estrellas).`,
      ],
    });
  }
  return findings;
}

async function fetchAcademicSources(query: string, limit: number): Promise<WebFinding[]> {
  const data = await fetchJsonWithTimeout<{
    message?: {
      items?: Array<{
        title?: string[];
        URL?: string;
        published?: { 'date-parts'?: number[][] };
        'container-title'?: string[];
        abstract?: string;
      }>;
    };
  }>(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}`);

  const findings: WebFinding[] = [];
  for (const item of data?.message?.items ?? []) {
    const title = item.title?.[0];
    const url = item.URL;
    if (!title || !url) continue;
    const year = item.published?.['date-parts']?.[0]?.[0];
    const journal = item['container-title']?.[0];
    const cleanAbstract = item.abstract
      ? decodeHtmlEntities(item.abstract.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 320)
      : '';
    const meta = [journal, year ? `(${year})` : null].filter(Boolean).join(' ');
    findings.push({
      sourceTitle: `${title} — Crossref`,
      sourceUrl: url,
      origin: 'Crossref',
      excerpts: [cleanAbstract || `Publicación indexada ${meta || 'en Crossref'}.`],
    });
  }
  return findings;
}

async function fetchDirectUrlFinding(url: string, query: string): Promise<WebFinding | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NexusEdge-Researcher/1.0',
        Accept: 'text/html,application/xhtml+xml,text/plain',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/') && !contentType.includes('html') && !contentType.includes('json')) {
      return null;
    }
    const raw = await res.text();
    const { title, paragraphs } = stripHtmlToCleanText(raw);
    const ranked = rankRelevantExcerpts(query, paragraphs, 4);
    if (ranked.length === 0) return null;
    return {
      sourceTitle: title || url,
      sourceUrl: url,
      origin: 'Lectura directa de URL',
      excerpts: ranked,
    };
  } catch {
    return null;
  }
}

export function synthesizeResearchMarkdown(params: {
  query: string;
  intent: ResearchIntent;
  findings: WebFinding[];
  toneMode: ToneMode;
  verbosity: VerbosityMode;
  activeMemories: MemoryItem[];
}): string {
  const { query, findings, toneMode, verbosity, activeMemories } = params;

  if (findings.length === 0) {
    return [
      `No encontré resultados verificables en las fuentes web abiertas para **"${query}"**.`,
      '',
      '- Reformula con términos más específicos o incluye un enlace `https://...` directo para analizar la página completa.',
      '- Si buscas análisis sobre una URL o documentación técnica concreta, pégala en el mensaje.',
    ].join('\n');
  }

  const maxFindings = verbosity === 'concise' ? 2 : verbosity === 'balanced' ? 4 : 6;
  const maxExcerptsPerFinding = verbosity === 'concise' ? 1 : verbosity === 'balanced' ? 2 : 3;

  const selected = findings.slice(0, maxFindings);
  const primary = selected[0];
  const lines: string[] = [];

  // Direct lead answer from primary finding
  if (primary.excerpts[0]) {
    if (toneMode === 'analytical') {
      lines.push(`### Síntesis principal (${primary.origin})`);
      lines.push(primary.excerpts[0]);
    } else {
      lines.push(primary.excerpts[0]);
    }
  }

  // Secondary structured points
  const bullets: string[] = [];
  for (let i = 0; i < selected.length; i++) {
    const f = selected[i];
    const startIdx = i === 0 ? 1 : 0;
    const slice = f.excerpts.slice(startIdx, maxExcerptsPerFinding);
    for (const ex of slice) {
      bullets.push(`- **${f.sourceTitle}**: ${ex}`);
    }
    if (slice.length === 0 && i > 0 && f.excerpts[0]) {
      bullets.push(`- **${f.sourceTitle}**: ${f.excerpts[0]}`);
    }
  }

  if (bullets.length > 0) {
    lines.push('');
    if (toneMode === 'analytical') {
      lines.push('### Evidencia contrastada en la web');
    } else if (toneMode === 'creative') {
      lines.push('### Conexiones y contexto adicional');
    } else {
      lines.push('### Puntos clave encontrados');
    }
    lines.push(...bullets.slice(0, verbosity === 'concise' ? 3 : 8));
  }

  // Note personal memory alignment subtly only if goals/preferences match keywords
  const queryWords = extractKeywords(query);
  const matchedMemory = activeMemories.find((m) =>
    queryWords.some((w) => m.content.toLowerCase().includes(w))
  );
  if (matchedMemory) {
    lines.push('');
    lines.push(`> Contexto alineado con tu memoria: *${matchedMemory.content}*`);
  }

  return lines.join('\n');
}

export async function runWebResearch(params: {
  query: string;
  depth: ThinkingDepth;
  webEnabled: boolean;
  profile: UserProfile;
  memories: MemoryItem[];
  allowDirectUrlFetch?: boolean;
}): Promise<{ markdown: string; sources: GroundingSource[]; findings: WebFinding[] }> {
  const { query, depth, webEnabled, profile, memories, allowDirectUrlFetch = false } = params;
  const parsed = normalizeSearchQuery(query);
  const activeMemories = memories.filter((m) => m.active);

  if (
    parsed.urls.length === 0 &&
    /^(?:por favor\s+)?(?:recuerda|memoriza|anota|guarda|ten en cuenta|no olvides)\s+(?:que\s+)?/i.test(
      query.trim()
    )
  ) {
    const cleanFact = query
      .trim()
      .replace(
        /^(?:por favor\s+)?(?:recuerda|memoriza|anota|guarda|ten en cuenta|no olvides)\s+(?:que\s+)?/i,
        ''
      )
      .trim();
    return {
      markdown: `Guardado en tu memoria local: **${cleanFact}**. Aplicaré este criterio en las próximas consultas.`,
      sources: [],
      findings: [],
    };
  }

  if (!webEnabled && parsed.urls.length === 0) {
    const queryWords = extractKeywords(query);
    const matched = activeMemories.filter((m) =>
      queryWords.some((w) => m.content.toLowerCase().includes(w))
    );
    const reply =
      matched.length > 0
        ? [
            'Búsqueda web desactivada. Coincidencias en tu memoria local:',
            '',
            ...matched.map((m) => `- ${m.content}`),
          ].join('\n')
        : 'La búsqueda web en tiempo real está desactivada. Activa el botón **Web** para investigar en internet o pega una URL directa.';
    return { markdown: reply, sources: [], findings: [] };
  }

  const limit = depth === 'fast' ? 2 : depth === 'expert' ? 3 : 5;
  const tasks: Array<Promise<WebFinding[]>> = [];

  if (allowDirectUrlFetch && parsed.urls.length > 0) {
    tasks.push(
      Promise.all(parsed.urls.slice(0, 3).map((u) => fetchDirectUrlFinding(u, parsed.cleanQuery))).then(
        (items) => items.filter((x): x is WebFinding => x !== null)
      )
    );
  }

  if (parsed.intent === 'definition' && parsed.targetWord) {
    tasks.push(fetchWiktionary(parsed.targetWord));
    tasks.push(fetchWikipedia('es', parsed.targetWord, 2));
  } else if (parsed.intent === 'weather' && parsed.location) {
    tasks.push(fetchWeather(parsed.location));
  } else if (parsed.intent === 'tech') {
    tasks.push(fetchTechSources(parsed.cleanQuery, limit));
    tasks.push(fetchWikipedia('en', parsed.cleanQuery, 2));
  } else if (parsed.intent === 'academic') {
    tasks.push(fetchAcademicSources(parsed.cleanQuery, limit));
    tasks.push(fetchWikipedia('es', parsed.cleanQuery, 2));
    if (depth === 'deep') {
      tasks.push(fetchWikipedia('en', parsed.cleanQuery, 2));
    }
  } else {
    tasks.push(fetchWikipedia('es', parsed.cleanQuery, limit));
    if (depth !== 'fast') {
      tasks.push(fetchWikipedia('en', parsed.cleanQuery, 2));
      tasks.push(fetchTechSources(parsed.cleanQuery, 2));
    }
    if (depth === 'deep') {
      tasks.push(fetchAcademicSources(parsed.cleanQuery, 2));
    }
  }

  const settled = await Promise.all(tasks);
  const dedupMap = new Map<string, WebFinding>();
  for (const list of settled) {
    for (const item of list) {
      if (!dedupMap.has(item.sourceUrl)) {
        dedupMap.set(item.sourceUrl, item);
      }
    }
  }

  const findings = Array.from(dedupMap.values());
  const sources: GroundingSource[] = findings.map((f) => ({
    uri: f.sourceUrl,
    title: f.sourceTitle,
  }));

  const markdown = synthesizeResearchMarkdown({
    query: parsed.cleanQuery,
    intent: parsed.intent,
    findings,
    toneMode: profile.toneMode,
    verbosity: profile.verbosity,
    activeMemories,
  });

  return { markdown, sources, findings };
}
