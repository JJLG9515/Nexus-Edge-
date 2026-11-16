import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={match.index}
          className="rounded bg-white/10 px-1.5 py-0.5 text-[0.85em] font-mono text-sky-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (linkMatch) {
        tokens.push(
          <a
            key={match.index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        tokens.push(token);
      }
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    tokens.push(text.slice(lastIdx));
  }
  return tokens;
}

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0A0C0F]">
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2 text-xs text-slate-400">
        <span className="font-mono">{language || 'código'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar bloque de código"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-xs leading-relaxed font-mono text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const segments = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 text-[15px] leading-[1.65] text-slate-200">
      {segments.map((segment, idx) => {
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const inner = segment.slice(3, -3);
          const firstNewline = inner.indexOf('\n');
          const language = firstNewline >= 0 ? inner.slice(0, firstNewline).trim() : '';
          const code = firstNewline >= 0 ? inner.slice(firstNewline + 1) : inner;
          return <CodeBlock key={idx} language={language} code={code} />;
        }

        const lines = segment.split('\n');
        const elements: React.ReactNode[] = [];
        let listBuffer: { ordered: boolean; items: string[] } | null = null;

        const flushList = (keyPrefix: string) => {
          if (!listBuffer) return;
          if (listBuffer.ordered) {
            elements.push(
              <ol key={keyPrefix} className="list-decimal list-outside ml-5 space-y-1.5 text-slate-200">
                {listBuffer.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          } else {
            elements.push(
              <ul key={keyPrefix} className="list-disc list-outside ml-5 space-y-1.5 text-slate-200">
                {listBuffer.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          }
          listBuffer = null;
        };

        lines.forEach((rawLine, lineIdx) => {
          const line = rawLine.trimEnd();
          if (!line.trim()) {
            flushList(`${idx}-l-${lineIdx}`);
            return;
          }

          const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
          const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);

          if (ulMatch) {
            if (listBuffer && listBuffer.ordered) flushList(`${idx}-l-${lineIdx}`);
            if (!listBuffer) listBuffer = { ordered: false, items: [] };
            listBuffer.items.push(ulMatch[1]);
            return;
          }

          if (olMatch) {
            if (listBuffer && !listBuffer.ordered) flushList(`${idx}-l-${lineIdx}`);
            if (!listBuffer) listBuffer = { ordered: true, items: [] };
            listBuffer.items.push(olMatch[1]);
            return;
          }

          flushList(`${idx}-l-${lineIdx}`);

          if (line.startsWith('### ')) {
            elements.push(
              <h4 key={`${idx}-${lineIdx}`} className="pt-2 text-base font-semibold text-white font-display">
                {renderInline(line.slice(4))}
              </h4>
            );
          } else if (line.startsWith('## ')) {
            elements.push(
              <h3 key={`${idx}-${lineIdx}`} className="pt-2 text-lg font-semibold text-white font-display">
                {renderInline(line.slice(3))}
              </h3>
            );
          } else if (line.startsWith('# ')) {
            elements.push(
              <h2 key={`${idx}-${lineIdx}`} className="pt-2 text-xl font-bold text-white font-display">
                {renderInline(line.slice(2))}
              </h2>
            );
          } else if (line.startsWith('> ')) {
            elements.push(
              <blockquote
                key={`${idx}-${lineIdx}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-300"
              >
                {renderInline(line.slice(2))}
              </blockquote>
            );
          } else {
            elements.push(
              <p key={`${idx}-${lineIdx}`} className="break-words">
                {renderInline(line)}
              </p>
            );
          }
        });

        flushList(`${idx}-end`);
        return <React.Fragment key={idx}>{elements}</React.Fragment>;
      })}
    </div>
  );
};
