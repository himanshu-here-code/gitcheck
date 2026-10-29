'use client';
import { useState } from 'react';
import type { FileEvidence } from '@/lib/types';

export function CodePreview({ files }: { files: FileEvidence[] }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!files || files.length === 0) return null;

  const totalMatches = files.reduce((sum, f) => sum + f.matches.length, 0);
  const totalFiles = files.length;
  const primaryFile = files[0];
  const primaryFileName = primaryFile.file.split('/').pop() ?? primaryFile.file;
  const active = files[Math.min(activeIndex, files.length - 1)];

  const summary =
    totalFiles === 1
      ? `${primaryFileName} · ${totalMatches} match${totalMatches === 1 ? '' : 'es'}`
      : `${totalFiles} files · ${totalMatches} match${totalMatches === 1 ? '' : 'es'}`;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="bd bs-sm press-sm inline-flex items-center gap-2 rounded-lg bg-card px-3 py-1.5 text-[12px] font-bold"
      >
        <CodeIcon size={13} />
        <span>{open ? 'Hide code' : `View code — ${summary}`}</span>
        <ChevronIcon
          size={12}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="bd mt-2 overflow-hidden rounded-xl bg-card"
          style={{ animation: 'pop-in 0.15s ease-out' }}
        >
          {/* File tabs */}
          {files.length > 1 && (
            <div
              className="flex flex-wrap border-b-2"
              style={{ borderColor: '#0a0a0a', background: '#f4f1ff' }}
            >
              {files.map((f, i) => {
                const name = f.file.split('/').pop() ?? f.file;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={f.file}
                    onClick={() => setActiveIndex(i)}
                    className="truncate border-r-2 px-3 py-2 font-mono text-[11px] font-bold transition-colors"
                    style={{
                      borderColor: '#0a0a0a',
                      background: isActive ? '#0a0a0a' : 'transparent',
                      color: isActive ? '#fff' : '#0a0a0a',
                      maxWidth: 240,
                    }}
                    title={f.file}
                  >
                    {name}
                    {f.matches.length > 1 && (
                      <span
                        className="ml-1.5 rounded-full px-1.5 text-[9px]"
                        style={{
                          background: isActive
                            ? 'rgba(255,255,255,0.2)'
                            : 'rgba(10,10,10,0.1)',
                        }}
                      >
                        {f.matches.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* File path (single-file) */}
          {files.length === 1 && (
            <div
              className="flex items-center justify-between gap-2 border-b-2 px-3 py-2"
              style={{ borderColor: '#0a0a0a', background: '#f4f1ff' }}
            >
              <span className="truncate font-mono text-[11px] font-bold">
                {active.file}
              </span>
              <span className="ml-2 shrink-0 font-mono text-[10px] text-muted">
                {active.matches.length} match
                {active.matches.length === 1 ? '' : 'es'}
              </span>
            </div>
          )}

          {/* Code block with context */}
          <div style={{ background: '#fef9ec' }}>
            {active.matches.map((match, matchIdx) => {
              const displayEnd = Math.min(match.matchEnd, match.text.length);
              const beforeMatch = match.text.slice(0, match.matchStart);
              const matchedText = match.text.slice(match.matchStart, displayEnd);
              const afterMatch = match.text.slice(displayEnd);

              return (
                <div key={`${match.line}-${matchIdx}`}>
                  {/* If multiple matches, show a divider */}
                  {matchIdx > 0 && (
                    <div 
                      className="border-t-2 border-dashed border-gray-300" 
                      style={{ margin: '8px 0' }} 
                    />
                  )}
                  
                  {match.context.map((ctxLine) => (
                    <div
                      key={`${ctxLine.line}-${ctxLine.isMatch}`}
                      className="flex"
                      style={{
                        background: ctxLine.isMatch ? '#fffbeb' : 'transparent',
                      }}
                    >
                      {/* Line Number */}
                      <span
                        className="select-none pl-3 pr-3 text-right font-mono text-[12px]"
                        style={{
                          color: ctxLine.isMatch ? '#0a0a0a' : '#9ca3af',
                          minWidth: 48,
                          userSelect: 'none',
                          opacity: ctxLine.isMatch ? 1 : 0.7,
                        }}
                      >
                        {ctxLine.line}
                      </span>

                      {/* Code Text */}
                      <span className="whitespace-pre pr-3 font-mono text-[12px]"
                        style={{ opacity: ctxLine.isMatch ? 1 : 0.6 }}
                      >
                        {ctxLine.isMatch ? (
                          <>
                            {beforeMatch}
                            <mark
                              style={{
                                background: '#f59e0b',
                                color: '#0a0a0a',
                                padding: '1px 2px',
                                borderRadius: 2,
                                fontWeight: 700,
                              }}
                            >
                              {matchedText}
                            </mark>
                            {afterMatch}
                          </>
                        ) : (
                          ctxLine.text || ' '
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {active.truncated && (
            <div
              className="border-t-2 px-3 py-2 text-[11px] text-muted"
              style={{ borderColor: '#0a0a0a' }}
            >
              More matches exist in this file — showing the first {active.matches.length}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function CodeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function ChevronIcon({
  size = 12,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}