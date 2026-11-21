import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MemoryItem, ThinkingDepth, UserProfile } from './src/types.ts';
import { DEFAULT_PROFILE, buildAdaptiveSystemPrompt } from './src/utils/memoryEngine.ts';
import { runWebResearch } from './src/utils/webResearcher.ts';
import { extractLocalInsights } from './src/utils/localLearner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || '';

interface ChatRequestBody {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  profile?: UserProfile;
  memories?: MemoryItem[];
  thinkingDepth?: ThinkingDepth;
  webSearch?: boolean;
  image?: {
    mimeType: string;
    base64Data: string;
  } | null;
}

interface LearnRequestBody {
  userMessage: string;
  existingMemories?: Array<{ category: string; content: string }>;
}

async function detectLocalOllamaModel(): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = data.models ?? [];
    if (models.length === 0) return null;
    if (OLLAMA_MODEL && models.some((m) => m.name === OLLAMA_MODEL)) {
      return OLLAMA_MODEL;
    }
    return models[0].name;
  } catch {
    return null;
  }
}

async function streamWithLocalOllama(params: {
  model: string;
  userMessage: string;
  systemInstruction: string;
  webContext: string;
  imageBase64?: string;
  onChunk: (text: string) => void;
}): Promise<string> {
  const prompt = params.webContext
    ? `Información investigada en la web en tiempo real:\n${params.webContext}\n\nConsulta del usuario:\n${params.userMessage}`
    : params.userMessage;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      system: params.systemInstruction,
      prompt,
      stream: true,
      ...(params.imageBase64 ? { images: [params.imageBase64] } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama local respondió ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as { response?: string };
        if (parsed.response) {
          fullText += parsed.response;
          params.onChunk(parsed.response);
        }
      } catch {
        // Ignore partial JSON line
      }
    }
  }

  return fullText;
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Allow Capacitor / local mobile origins cleanly
  app.use('/api', (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', async (_req, res) => {
    const localModel = await detectLocalOllamaModel();
    res.json({
      ok: true,
      engine: localModel ? `ollama:${localModel}+web` : 'keyless-web-research',
      requiresApiKey: false,
    });
  });

  app.post('/api/chat', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const body = req.body as ChatRequestBody;
      const userMessage = typeof body?.message === 'string' ? body.message.trim() : '';
      if (!userMessage && !body?.image) {
        sendEvent('error', { message: 'El mensaje no puede estar vacío.' });
        res.end();
        return;
      }

      const profile = body.profile ? { ...DEFAULT_PROFILE, ...body.profile } : DEFAULT_PROFILE;
      const memories = Array.isArray(body.memories) ? body.memories : [];
      const depth: ThinkingDepth = body.thinkingDepth || 'expert';
      const webEnabled = body.webSearch !== false;

      const research = await runWebResearch({
        query: userMessage || 'Análisis visual local',
        depth,
        webEnabled,
        profile,
        memories,
        allowDirectUrlFetch: true,
      });

      const localModel = await detectLocalOllamaModel();
      let fullText = '';

      if (localModel) {
        const webContext = research.findings
          .map((f) => `[${f.sourceTitle} (${f.sourceUrl})]\n${f.excerpts.join('\n')}`)
          .join('\n\n');
        const systemInstruction = buildAdaptiveSystemPrompt(profile, memories, null);
        fullText = await streamWithLocalOllama({
          model: localModel,
          userMessage: userMessage || 'Analiza esta imagen con precisión.',
          systemInstruction,
          webContext,
          imageBase64: body.image?.base64Data,
          onChunk: (chunk) => sendEvent('chunk', { text: chunk }),
        });
      } else {
        if (body.image && !userMessage) {
          fullText =
            'Para analizar imágenes sin APIs externas, ejecuta un modelo de visión local con Ollama en UserLAnd (por ejemplo `ollama run moondream`) o escribe tu consulta junto a la imagen para investigarla en la web.';
        } else {
          fullText = research.markdown;
        }
        sendEvent('chunk', { text: fullText });
      }

      sendEvent('done', {
        fullText,
        sources: research.sources,
      });
      res.end();
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      sendEvent('error', {
        message: errorObj?.message || 'Error al investigar en la web en tiempo real.',
      });
      res.end();
    }
  });

  app.post('/api/learn', (req, res) => {
    const body = req.body as LearnRequestBody;
    if (!body?.userMessage) {
      res.status(400).json({ error: 'Se requiere userMessage.' });
      return;
    }

    const insights = extractLocalInsights(
      body.userMessage,
      Array.isArray(body.existingMemories) ? body.existingMemories : []
    );
    res.json({ insights });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexus Edge server (keyless web research) listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Nexus Edge server:', err);
  process.exit(1);
});
