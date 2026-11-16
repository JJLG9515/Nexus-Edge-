import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY no está configurada. Agrega tu clave en Settings > Secrets para activar el motor Gemini.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapThinkingDepth(depth: unknown): ThinkingLevel {
  if (depth === 'fast') return ThinkingLevel.LOW;
  if (depth === 'deep') return ThinkingLevel.XHIGH;
  return ThinkingLevel.HIGH;
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>)"']+/gi) ?? [];
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;!?]+$/, '')))).slice(0, 20);
}

interface IncomingHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  message: string;
  history?: IncomingHistoryItem[];
  systemInstruction?: string;
  thinkingDepth?: 'fast' | 'expert' | 'deep';
  webSearch?: boolean;
  image?: {
    mimeType: string;
    base64Data: string;
  } | null;
}

interface LearnRequestBody {
  userMessage: string;
  assistantMessage: string;
  existingMemories?: Array<{ category: string; content: string }>;
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      model: 'gemini-4-hydrogen',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
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

      const ai = getAiClient();
      const history = Array.isArray(body.history) ? body.history.slice(-14) : [];
      type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
      const contents: Array<{ role: 'user' | 'model'; parts: ContentPart[] }> = history.map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }],
      }));

      const userParts: ContentPart[] = [];
      if (body.image?.base64Data && body.image?.mimeType) {
        userParts.push({
          inlineData: {
            mimeType: body.image.mimeType,
            data: body.image.base64Data,
          },
        });
      }
      userParts.push({
        text: userMessage || 'Analiza esta imagen con precisión técnica.',
      });

      contents.push({
        role: 'user',
        parts: userParts,
      });

      const urls = extractUrls(userMessage);
      const tools: Array<{ googleSearch?: Record<string, never>; urlContext?: Record<string, never> }> = [];
      if (body.webSearch) {
        tools.push({ googleSearch: {} });
      }
      if (urls.length > 0) {
        tools.push({ urlContext: {} });
      }

      const stream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction:
            typeof body.systemInstruction === 'string' && body.systemInstruction.trim().length > 0
              ? body.systemInstruction
              : 'Eres Nexus Edge, un asistente personal experto, directo y eficiente.',
          thinkingConfig: {
            thinkingLevel: mapThinkingDepth(body.thinkingDepth),
          },
          ...(tools.length > 0 ? { tools } : {}),
        },
      });

      const sourcesMap = new Map<string, { uri: string; title: string }>();
      let fullText = '';

      for await (const chunk of stream) {
        const textPart = chunk.text;
        if (textPart) {
          fullText += textPart;
          sendEvent('chunk', { text: textPart });
        }

        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (Array.isArray(groundingChunks)) {
          for (const g of groundingChunks) {
            const uri = g.web?.uri;
            if (uri && !sourcesMap.has(uri)) {
              sourcesMap.set(uri, {
                uri,
                title: g.web?.title || uri,
              });
            }
          }
        }
      }

      sendEvent('done', {
        fullText,
        sources: Array.from(sourcesMap.values()),
      });
      res.end();
    } catch (err: unknown) {
      const errorObj = err as { message?: string; status?: number };
      const raw = errorObj?.message || 'Error al comunicarse con el motor de IA.';
      let friendly = raw;
      if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
        friendly =
          'Límite de cuota de Gemini API alcanzado (429). Verifica tu clave y cuota en Settings > Secrets.';
      } else if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
        friendly =
          'Clave de Gemini API inválida o sin permisos. Verifica GEMINI_API_KEY en Settings > Secrets.';
      } else if (raw.includes('404') || raw.includes('NOT_FOUND')) {
        friendly = 'El modelo Gemini solicitado no está disponible actualmente (404).';
      }
      sendEvent('error', { message: friendly });
      res.end();
    }
  });

  app.post('/api/learn', async (req, res) => {
    try {
      const body = req.body as LearnRequestBody;
      if (!body?.userMessage || !body?.assistantMessage) {
        res.status(400).json({ error: 'Se requiere userMessage y assistantMessage.' });
        return;
      }

      const ai = getAiClient();
      const existingSummary = Array.isArray(body.existingMemories)
        ? body.existingMemories
            .slice(0, 20)
            .map((m) => `[${m.category}] ${m.content}`)
            .join('\n')
        : '';

      const prompt = [
        'Analiza el intercambio reciente y extrae SOLO aprendizajes duraderos y útiles sobre el usuario.',
        'Categorías permitidas: preference (preferencias de flujo o formato), style (estilo de comunicación), goal (objetivos a largo plazo), fact (hechos/contexto del usuario o sus proyectos).',
        'No inventes datos. Si no hay nada nuevo o relevante, devuelve un arreglo vacío.',
        existingSummary ? `\nMemorias existentes:\n${existingSummary}` : '',
        `\nMensaje del usuario:\n${body.userMessage}`,
        `\nRespuesta del asistente:\n${body.assistantMessage.slice(0, 1500)}`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: {
                      type: Type.STRING,
                      description: 'Uno de: preference, style, goal, fact',
                    },
                    content: {
                      type: Type.STRING,
                      description: 'Descripción concisa en español (máximo 140 caracteres).',
                    },
                    confidence: {
                      type: Type.NUMBER,
                      description: 'Confianza entre 0.5 y 1.0',
                    },
                  },
                  required: ['category', 'content', 'confidence'],
                },
              },
            },
            required: ['insights'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"insights":[]}').trim()) as {
        insights?: Array<{ category: string; content: string; confidence: number }>;
      };

      const validCategories = new Set(['preference', 'style', 'goal', 'fact']);
      const insights = (parsed.insights ?? []).filter(
        (item) => validCategories.has(item.category) && typeof item.content === 'string' && item.content.trim().length > 5
      );

      res.json({ insights });
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      res.status(500).json({ error: errorObj?.message || 'Error al analizar aprendizaje continuo.' });
    }
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
    console.log(`Nexus Edge server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Nexus Edge server:', err);
  process.exit(1);
});
