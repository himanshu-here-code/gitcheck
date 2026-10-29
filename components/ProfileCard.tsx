'use client';
import { useEffect, useState } from 'react';
import { ScoreRing } from './ScoreRing';
import { ClipboardIcon, CheckIcon, LockIcon } from './Icons';
import { ShareButton } from './ShareButton';
import { PURPOSE_LABELS } from '@/lib/detect/checks-by-purpose';
import { TYPE_LABELS } from '@/lib/detect/checks-by-type';

export function ProfileCard({
  result,
  buildFullReport,
}: {
  result: any;
  buildFullReport: () => string;
}) {
  const [copied, setCopied] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [owner, setOwner] = useState<string>('');
  const [showPrivate, setShowPrivate] = useState(false);

  useEffect(() => {
    const [ownerLogin] = (result.repo as string).split('/');
    setOwner(ownerLogin);

    fetch(`https://api.Github.com/users/${ownerLogin}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.avatar_url) setAvatar(d.avatar_url);
      })
      .catch(() => {});
  }, [result.repo]);

  async function copyFull() {
    try {
      await navigator.clipboard.writeText(buildFullReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  }

  const typeLabel =
    result.projectType?.type && result.projectType.type !== 'unknown'
      ? TYPE_LABELS[result.projectType.type as keyof typeof TYPE_LABELS]
      : null;

  const purposeLabel =
    result.projectPurpose?.purpose &&
    result.projectPurpose.purpose !== 'unknown'
      ? PURPOSE_LABELS[
          result.projectPurpose.purpose as keyof typeof PURPOSE_LABELS
        ]
      : null;

  const skippedChecks: string[] = result.skippedChecks ?? [];
  const isPrivate = !!result.private;

  return (
    <div className="bd bs-lg rounded-3xl bg-card p-8 md:p-10">
      {/* ------------------------------------------------------------------ */}
      {/* CONTEXT BANNER — the "we know what this is" moment                  */}
      {/* ------------------------------------------------------------------ */}
      <ContextBanner
        typeLabel={typeLabel}
        purposeLabel={purposeLabel}
        fileCount={result.fileCount}
        ranChecks={7 - skippedChecks.length}
        skippedChecks={skippedChecks}
        isPrivate={isPrivate}
        onPrivateClick={() => setShowPrivate(!showPrivate)}
      />

      <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-center">
        <ScoreRing score={result.score} />

        <div className="min-w-0 flex-1">
          {/* Repo identity */}
          <div className="flex items-center gap-3">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt={owner}
                width={40}
                height={40}
                className="bd shrink-0 rounded-full"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div
                className="bd flex shrink-0 items-center justify-center rounded-full bg-accent-2 font-bold"
                style={{ width: 40, height: 40 }}
              >
                {owner[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-mono text-lg font-bold leading-tight">
                {result.repo}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {result.fileCount} files analyzed
              </div>
            </div>
          </div>

          {/* Verdict */}
          <p className="mt-5 text-[15px] leading-relaxed">
            {verdictCopy(result.score, result.projectPurpose?.purpose)}
          </p>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={copyFull}
              className="bd bs-sm press-sm inline-flex items-center gap-2 rounded-xl bg-accent-3 px-4 py-2.5 text-[13px] font-bold"
            >
              {copied ? <CheckIcon size={15} /> : <ClipboardIcon size={15} />}
              {copied ? 'Copied' : 'Copy fix prompt for AI'}
            </button>

            {!isPrivate && (
              <ShareButton
                repo={result.repo}
                score={result.score}
                grade={result.grade}
                result={result}
              />
            )}

            {isPrivate && (
              <button
                onClick={() => setShowPrivate(!showPrivate)}
                className="bd bs-sm press-sm inline-flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-[13px] font-bold"
              >
                <LockIcon size={14} />
                Why no share?
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Private scan info panel */}
      {isPrivate && showPrivate && (
        <div
          className="pop mt-6 rounded-xl border-2 px-4 py-3 text-[13px] leading-relaxed"
          style={{ borderColor: '#0a0a0a', background: '#fef9ec' }}
        >
          <p>
            <strong>This was a private scan.</strong> Your GitHub token was
            used for this request only and was not stored. The result is not
            cached, so this report exists only in your browser tab.
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Context banner — the demo hook
// =============================================================================

function ContextBanner({
  typeLabel,
  purposeLabel,
  fileCount,
  ranChecks,
  skippedChecks,
  isPrivate,
  onPrivateClick,
}: {
  typeLabel: string | null;
  purposeLabel: string | null;
  fileCount: number;
  ranChecks: number;
  skippedChecks: string[];
  isPrivate: boolean;
  onPrivateClick: () => void;
}) {
  if (!typeLabel && !purposeLabel) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border-2 px-5 py-4"
      style={{ borderColor: '#0a0a0a', background: '#f4f1ff' }}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        <span>Detected</span>
        {isPrivate && (
          <button
            onClick={onPrivateClick}
            className="inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-opacity hover:opacity-80"
            style={{
              background: '#fbbf24',
              borderColor: '#0a0a0a',
              color: '#0a0a0a',
            }}
          >
            <LockIcon size={10} />
            Private
          </button>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {typeLabel && (
          <span className="font-display text-2xl leading-tight">
            {typeLabel}
          </span>
        )}
        {typeLabel && purposeLabel && (
          <span className="text-lg text-muted">·</span>
        )}
        {purposeLabel && (
          <span className="font-display italic text-2xl leading-tight text-accent">
            {purposeLabel}
          </span>
        )}
      </div>

      <div className="mt-2 text-[12px] leading-relaxed text-muted">
        <strong style={{ color: '#0a0a0a' }}>
          Ran {ranChecks} check{ranChecks === 1 ? '' : 's'} on {fileCount} files.
        </strong>
        {skippedChecks.length > 0 && (
          <>
            {' '}
            Skipped {skippedChecks.length} — {skipReason(typeLabel ?? '', skippedChecks)}.
          </>
        )}
      </div>
    </div>
  );
}

function skipReason(typeLabel: string, skipped: string[]): string {
  if (skipped.includes('legal')) {
    return 'legal checks assume real users, which this repo doesn\u2019t have';
  }
  if (skipped.includes('seo')) {
    return 'SEO doesn\u2019t apply to this kind of project';
  }
  if (skipped.includes('errors')) {
    return 'error pages don\u2019t apply here';
  }
  return 'they don\u2019t apply to this kind of project';
}

function verdictCopy(score: number, purpose?: string): string {
  const isLow =
    purpose === 'learning' ||
    purpose === 'experiment' ||
    purpose === 'docs' ||
    purpose === 'boilerplate';

  if (isLow) {
    if (score >= 60)
      return 'Rough around the edges, but expected for a project with this purpose. Fix the criticals if you care about polish.';
    if (score >= 30)
      return 'A few code quality issues, nothing serious for this kind of project.';
    if (score >= 15)
      return 'Clean. Nothing to fix unless you plan to ship this as a product.';
    return 'Very clean. Well maintained.';
  }

  if (score >= 70)
    return 'This is a prototype, not a product. The issues below are why people bounce — fix the criticals first.';
  if (score >= 50)
    return 'Clear vibecoded signals. Work through the critical issues before sharing this link.';
  if (score >= 30)
    return 'Getting close. A few rough edges are keeping this from feeling finished.';
  if (score >= 15)
    return 'Looking solid. Polish the remaining items and ship it.';
  return 'This looks professional. The remaining items are minor.';
}