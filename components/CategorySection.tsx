'use client';
import { useState } from 'react';
import { IssueCard } from './IssueCard';
import {
  LegalIcon,
  SeoIcon,
  ErrorsIcon,
  HygieneIcon,
  SignaturesIcon,
  QualityIcon,
  AnalyticsIcon,
  SecurityIcon,
} from './categoryIcons';
import type { Issue } from '@/lib/types';

interface Meta {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  bg: string;
  fg: string;
}

const META: Record<string, Meta> = {
  legal: {
    title: 'Legal & Trust',
    icon: LegalIcon,
    bg: '#8b5cf6',
    fg: '#ffffff',
  },
  seo: {
    title: 'SEO & Meta',
    icon: SeoIcon,
    bg: '#38bdf8',
    fg: '#0a0a0a',
  },
  errors: {
    title: 'Errors & Edge States',
    icon: ErrorsIcon,
    bg: '#fbbf24',
    fg: '#0a0a0a',
  },
  hygiene: {
    title: 'Code Hygiene',
    icon: HygieneIcon,
    bg: '#34d399',
    fg: '#0a0a0a',
  },
  signatures: {
    title: 'vibecoded Signs',
    icon: SignaturesIcon,
    bg: '#8b5cf6',
    fg: '#ffffff',
  },
  quality: {
    title: 'Code Quality',
    icon: QualityIcon,
    bg: '#f472b6',
    fg: '#0a0a0a',
  },
  analytics: {
    title: 'Analytics',
    icon: AnalyticsIcon,
    bg: '#38bdf8',
    fg: '#0a0a0a',
  },
  security: {
    title: 'Security',
    icon: SecurityIcon,
    bg: '#ef4444',
    fg: '#ffffff',
  },
};

export function CategorySection({
  category,
  issues,
}: {
  category: string;
  issues: Issue[];
}) {
  const [open, setOpen] = useState(true);
  const meta =
    META[category] ??
    ({
      title: category,
      icon: SignaturesIcon,
      bg: '#8b5cf6',
      fg: '#ffffff',
    } as Meta);

  const Icon = meta.icon;

  return (
    <section className="bd bs-lg overflow-hidden rounded-3xl bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center rounded-xl border-2"
            style={{
              width: 44,
              height: 44,
              background: meta.bg,
              color: meta.fg,
              borderColor: '#0a0a0a',
            }}
          >
            <Icon size={20} />
          </div>
          <div>
            <h2 className="headline text-2xl">{meta.title}</h2>
            <div className="mt-0.5 text-xs font-semibold text-muted">
              {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
            </div>
          </div>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          className="space-y-4 border-t-2 px-6 py-6"
          style={{ borderColor: '#0a0a0a' }}
        >
          {issues.map((i) => (
            <IssueCard key={i.id} issue={i} />
          ))}
        </div>
      )}
    </section>
  );
}