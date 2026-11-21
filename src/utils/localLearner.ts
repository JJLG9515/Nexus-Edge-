import type { MemoryCategory } from '../types.ts';
import type { IncomingMemoryCandidate } from './memoryEngine.ts';

interface ExistingMemorySummary {
  category: string;
  content: string;
}

const EXPLICIT_MEMORY_TRIGGERS = [
  /^(?:por favor\s+)?(?:recuerda|memoriza|anota|guarda|ten en cuenta|no olvides)\s+(?:que\s+)?(.+)/i,
  /\brecuerda\s+que\s+(.+)/i,
  /\bten\s+en\s+cuenta\s+que\s+(.+)/i,
];

function inferCategory(text: string): MemoryCategory {
  const lower = text.toLowerCase();
  if (
    /(respuesta|respuestas|tono|directo|directa|conciso|concisa|breve|resumen|puntos|viñetas|formato|estilo|sin adornos|sin relleno|hablame|háblame|explicaci[oó]n|t[eé]cnic)/i.test(
      lower
    )
  ) {
    return 'style';
  }
  if (/(objetivo|meta|quiero lograr|planeo|proyecto|estoy construyendo|estoy creando)/i.test(lower)) {
    return 'goal';
  }
  if (/(prefiero|me gusta|prioriza|priorizar|siempre usa|evita|no uses|mejor en)/i.test(lower)) {
    return 'preference';
  }
  return 'fact';
}

function cleanSentence(raw: string): string {
  return raw
    .trim()
    .replace(/^[:,\-–\s]+/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 160);
}

export function extractLocalInsights(
  userMessage: string,
  existingMemories: ExistingMemorySummary[] = []
): IncomingMemoryCandidate[] {
  const text = userMessage.trim();
  if (text.length < 8) return [];

  const candidates: IncomingMemoryCandidate[] = [];

  for (const regex of EXPLICIT_MEMORY_TRIGGERS) {
    const match = text.match(regex);
    if (match?.[1]) {
      const cleaned = cleanSentence(match[1]);
      if (cleaned.length >= 6) {
        candidates.push({
          category: inferCategory(cleaned),
          content: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
          confidence: 0.96,
        });
      }
      break;
    }
  }

  if (candidates.length === 0) {
    const styleMatch = text.match(
      /\b(prefiero\s+(?:explicaciones|respuestas|c[oó]digo|res[uú]menes)[^.!\n]{4,120})/i
    );
    if (styleMatch?.[1]) {
      const cleaned = cleanSentence(styleMatch[1]);
      candidates.push({
        category: 'style',
        content: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
        confidence: 0.88,
      });
    }

    const goalMatch = text.match(
      /\b((?:mi objetivo|mi meta|estoy trabajando en|quiero construir|quiero desarrollar)\s+(?:es\s+)?[^.!\n]{5,120})/i
    );
    if (goalMatch?.[1]) {
      const cleaned = cleanSentence(goalMatch[1]);
      candidates.push({
        category: 'goal',
        content: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
        confidence: 0.88,
      });
    }

    const deviceOrFactMatch = text.match(
      /\b((?:tengo un|uso un|mi tel[eé]fono es|soy\s+(?:ingeniero|desarrollador|programador|diseñador|estudiante))\s*[^.!\n]{3,110})/i
    );
    if (deviceOrFactMatch?.[1]) {
      const cleaned = cleanSentence(deviceOrFactMatch[1]);
      candidates.push({
        category: 'fact',
        content: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
        confidence: 0.85,
      });
    }
  }

  const existingNormalized = new Set(existingMemories.map((m) => m.content.toLowerCase().trim()));
  return candidates.filter((c) => !existingNormalized.has(c.content.toLowerCase().trim()));
}
