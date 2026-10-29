'use client';
import { useState } from 'react';
import { CopyIcon, CheckIcon, ShieldIcon } from './Icons';
import { CodePreview } from './CodePreview';
import type { Issue, Confidence } from '@/lib/types';

const SEV = {
  critical: { label: 'Critical', bg: '#ef4444', text: '#ffffff' },
  high: { label: 'High', bg: '#fbbf24', text: '#0a0a0a' },
  medium: { label: 'Medium', bg: '#38bdf8', text: '#0a0a0a' },
  low: { label: 'Low', bg: '#34d399', text: '#0a0a0a' },
} as const;

const CONF_LABEL: Record<Confidence, string | null> = {
  high: null,
  medium: 'Likely',
  low: 'Review',
};

export function IssueCard({ issue }: { issue: Issue }) {
  const [copied, setCopied] = useState(false);
  const sev = SEV[issue.severity] ?? SEV.low;
  const confidence: Confidence = issue.confidence ?? 'high';
  const confLabel = CONF_LABEL[confidence];
  const isSecurity = issue.category === 'security';

  const filesList = issue.affectedFiles?.length
    ? issue.affectedFiles.map((f: string) => `- ${f}`).join('\n')
    : '';

  const prompt = `Fix this issue in my app: ${issue.title}

${issue.description}

${filesList ? `Affected files:\n${filesList}\n\n` : ''}Suggested approach: ${issue.fix}

Please make the change, keeping the existing design system and code style.`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <article
      className="bd rounded-2xl bg-card p-6"
      style={isSecurity ? { borderColor: '#ef4444', borderWidth: 3 } : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3
          className="flex items-start gap-2 text-[17px] font-bold leading-snug"
          style={{ flex: '1 1 240px' }}
        >
          {isSecurity && (
            <span
              className="mt-0.5 shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-md"
              style={{ background: '#ef4444', color: '#fff' }}
              aria-label="Security issue"
            >
              <ShieldIcon size={12} />
            </span>
          )}
          <span>{issue.title}</span>
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {confLabel && (
            <span
              className="rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                background: '#f4f1ff',
                color: '#0a0a0a',
                borderColor: '#0a0a0a',
              }}
            >
              {confLabel}
            </span>
          )}
          <span
            className="rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ background: sev.bg, color: sev.text, borderColor: '#0a0a0a' }}
          >
            {sev.label}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        {issue.description}
      </p>

      {issue.affectedFiles && issue.affectedFiles.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Files affected
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {issue.affectedFiles.map((f: string) => (
              <span
                key={f}
                className="rounded-md border px-2 py-0.5 font-mono text-[11px]"
                style={{ borderColor: 'rgba(10,10,10,0.15)', color: '#6b6b6b' }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {issue.evidence && issue.evidence.length > 0 && (
        <CodePreview files={issue.evidence} />
      )}

      <div
        className="mt-4 rounded-xl border-2 p-4"
        style={{ borderColor: '#0a0a0a', background: '#fef9ec' }}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          How to fix
        </div>
        <p className="mt-2 text-[15px] leading-relaxed font-medium">
          {issue.fix}
        </p>
      </div>

      <button
        onClick={copy}
        className="bd bs-sm press-sm mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-3 px-3.5 py-2 text-[13px] font-bold"
      >
        {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        {copied ? 'Copied!' : 'Copy fix prompt'}
      </button>
    </article>
  );
}