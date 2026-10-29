'use client';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { ScanInput } from '@/components/ScanInput';
import { LoadingScan } from '@/components/LoadingScan';
import { ProfileCard } from '@/components/ProfileCard';
import { StatGrid } from '@/components/StatGrid';
import { CategorySection } from '@/components/CategorySection';
import type { Issue } from '@/lib/types';

// =============================================================================
// Constants — hoisted so they aren't recreated on every render
// =============================================================================

const CATEGORY_ORDER = [
  'security',
  'legal',
  'seo',
  'errors',
  'hygiene',
  'signatures',
  'quality',
  'analytics',
] as const;

const CATEGORY_TITLES: Record<string, string> = {
  security: 'Security',
  legal: 'Legal & Trust',
  seo: 'SEO & Meta',
  errors: 'Errors & Edge States',
  hygiene: 'Code Hygiene',
  signatures: 'Vibecoded Signatures',
  quality: 'Code Quality',
  analytics: 'Analytics',
};

const TYPE_LABELS_LONG: Record<string, string> = {
  'web-app': 'a web application',
  'cli-tool': 'a command-line tool',
  library: 'a library / SDK',
  'mobile-app': 'a mobile app',
  'browser-extension': 'a browser extension',
  'api-service': 'an API service',
  docs: 'a documentation site',
  unknown: 'an unclassified project',
};

const PURPOSE_LABELS_LONG: Record<string, string> = {
  product: 'built as a product',
  learning: 'built as a learning project',
  portfolio: 'built as a portfolio project',
  docs: 'built as documentation',
  boilerplate: 'built as a starter template',
  experiment: 'built as an experiment',
  unknown: 'with no clear purpose stated',
};

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

// Signals that are fallback noise, not real classifier evidence.
const FALLBACK_SIGNAL = /no strong signals|app-like type, no strong purpose/i;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function scan(repoUrl: string, authToken?: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, authToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Scan failed');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function handleReset() {
      setResult(null);
      setError(null);
      setLoading(false);
      if (window.location.search) {
        window.history.replaceState({}, '', '/');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.addEventListener('GitCheck:reset', handleReset);
    return () => window.removeEventListener('GitCheck:reset', handleReset);
  }, []);

  const grouped = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, Issue[]>();
    for (const issue of result.issues as Issue[]) {
      if (!map.has(issue.category)) map.set(issue.category, []);
      map.get(issue.category)!.push(issue);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      issues: map.get(c)!,
    }));
  }, [result]);

  // ---------------------------------------------------------------------------
  // Build the AI-fix brief. This is what gets pasted into Cursor.
  // ---------------------------------------------------------------------------
  const buildFullReport = (): string => {
    if (!result) return '';
    const lines: string[] = [];
    const issues: Issue[] = result.issues ?? [];

    const detectedType =
      result.projectType?.type && result.projectType.type !== 'unknown'
        ? (result.projectType.type as string)
        : null;
    const detectedPurpose =
      result.projectPurpose?.purpose &&
      result.projectPurpose.purpose !== 'unknown'
        ? (result.projectPurpose.purpose as string)
        : null;

    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const highCount = issues.filter((i) => i.severity === 'high').length;
    const mediumCount = issues.filter((i) => i.severity === 'medium').length;
    const lowCount = issues.filter((i) => i.severity === 'low').length;

    // =========================================================================
    // Title + summary
    // =========================================================================
    lines.push('# Code Quality Fix Request');
    lines.push('');
    lines.push(
      `I ran my GitHub repo through **GitCheck**, a static analysis tool that finds the small things that make an app look like a prototype instead of a finished product. Below is the full report and an ordered fix plan.`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    // =========================================================================
    // Repo context
    // =========================================================================
    lines.push('## About this project');
    lines.push('');
    lines.push(`- **Repository:** \`${result.repo}\``);
    lines.push(`- **Files analyzed:** ${result.fileCount}`);
    if (detectedType) {
      lines.push(
        `- **Detected project type:** ${TYPE_LABELS_LONG[detectedType] ?? detectedType}`
      );
    }
    if (detectedPurpose) {
      lines.push(
        `- **Detected purpose:** ${PURPOSE_LABELS_LONG[detectedPurpose] ?? detectedPurpose}`
      );
    }
    lines.push(
      `- **Vibecoded score:** ${result.score}% (grade ${result.grade}) — lower is better`
    );
    lines.push(
      `- **Issues found:** ${issues.length} total (${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low)`
    );
    lines.push(`- **Checks passed:** ${result.passed.length}`);
    lines.push('');
    lines.push(
      `If you need more context about any of this, read the repo's README.md first — it will tell you what the app actually does.`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    // =========================================================================
    // Detection context — only rendered when there are substantive signals.
    // Fallback strings like "no strong signals" don't belong in a report.
    // =========================================================================
    const typeSignals: string[] = result.projectType?.signals ?? [];
    const purposeSignals: string[] = result.projectPurpose?.signals ?? [];

    const hasRealTypeSignals =
      typeSignals.length > 0 &&
      !typeSignals.every((s) => FALLBACK_SIGNAL.test(s));

    const hasRealPurposeSignals =
      purposeSignals.length > 0 &&
      result.projectPurpose?.purpose !== 'unknown' &&
      !purposeSignals.every((s) => FALLBACK_SIGNAL.test(s));

    if (hasRealTypeSignals || hasRealPurposeSignals) {
      lines.push('## Why GitCheck classified this repo the way it did');
      lines.push('');
      lines.push(
        `Static analyzers make classification guesses. Here's why GitCheck made its calls — if any of these are wrong, adjust the fix plan accordingly.`
      );
      lines.push('');

      if (hasRealTypeSignals) {
        lines.push(`**Project type (${detectedType ?? 'unknown'}) — signals:**`);
        for (const sig of typeSignals) {
          lines.push(`  - ${sig}`);
        }
        lines.push('');
      }
      if (hasRealPurposeSignals) {
        lines.push(
          `**Project purpose (${detectedPurpose ?? 'unknown'}) — signals:**`
        );
        for (const sig of purposeSignals) {
          lines.push(`  - ${sig}`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    // =========================================================================
    // Skipped checks
    // =========================================================================
    const skippedChecks: string[] = result.skippedChecks ?? [];
    if (skippedChecks.length > 0) {
      lines.push('## Checks GitCheck skipped');
      lines.push('');
      lines.push(
        `GitCheck skips checks that don't apply to this kind of project. These were **not** run — they may still have issues, but the scanner didn't check:`
      );
      lines.push('');
      for (const check of skippedChecks) {
        const reason = skipReasonFor(check);
        lines.push(`- **${CATEGORY_TITLES[check] ?? check}** — ${reason}`);
      }
      lines.push('');
      lines.push(
        `If any of these actually matter to you, tell me and I'll extend the fix plan to cover them.`
      );
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // =========================================================================
    // Behavioral rules
    // =========================================================================
    lines.push('## What I need you to do');
    lines.push('');
    lines.push(
      `Go through the issues below one by one and fix them in my codebase. Follow these rules:`
    );
    lines.push('');
    lines.push(
      `1. **Work in priority order: Critical → High → Medium → Low.** Finish each severity tier, explain the fixes, then stop and wait for my review before moving to the next tier. Don't fix everything in one shot.`
    );
    lines.push(
      `2. **Be surgical.** Don't rewrite what isn't broken. Keep my existing design system, tech stack, file structure, and code style. Every fix should be additive or a targeted edit — not a refactor.`
    );
    lines.push(
      `3. **If an issue doesn't apply, say so and skip it.** GitCheck is a static analyzer — it makes mistakes. If you see something flagged that's actually fine (or the fix would break something), tell me *why* before skipping it. Don't silently ignore it.`
    );
    lines.push(
      `4. **Group related fixes into one change-set.** If three issues are all in the same component or file, they should be one edit, not three.`
    );
    lines.push(
      `5. **After each fix, explain in one or two sentences:** what changed, why, and what the improvement is. I want to learn from this — not just have working code.`
    );
    lines.push(
      `6. **Ask before installing new dependencies.** Some fixes (like adding a cookie consent banner) may require a library. Show me the package name and version before installing it.`
    );
    lines.push(
      `7. **Ask before making changes outside the affected files.** If a fix would require touching config, folder structure, or global state, confirm the scope with me first.`
    );
    lines.push(
      `8. **Every issue flagged is either a bug or a judgment call.** Issues marked \`LOW CONFIDENCE\` or \`LIKELY\` are the analyzer's heuristic guesses — verify against my actual code before changing anything.`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    // =========================================================================
    // Issues — grouped by category, ordered by severity within
    // =========================================================================
    lines.push('## Issues to fix');
    lines.push('');

    const totalToFix = issues.length;

    for (const category of CATEGORY_ORDER) {
      const catIssues = grouped.find((g) => g.category === category)?.issues;
      if (!catIssues || catIssues.length === 0) continue;

      lines.push(`### ${CATEGORY_TITLES[category] ?? category}`);
      lines.push('');

      const sorted = [...catIssues].sort(
        (a, b) =>
          SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
      );

      sorted.forEach((issue, idx) => {
        const conf = issue.confidence ?? 'high';
        const confTag =
          conf === 'low'
            ? ' ⚠️ LOW CONFIDENCE — verify before fixing'
            : conf === 'medium'
              ? ' · likely real'
              : '';
        lines.push(
          `#### ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.title}${confTag}`
        );
        lines.push('');
        lines.push(`**What it is:** ${issue.description}`);
        lines.push('');
        if (issue.affectedFiles?.length) {
          lines.push(`**Where:**`);
          for (const f of issue.affectedFiles) {
            lines.push(`  - \`${f}\``);
          }
          lines.push('');
        }
        lines.push(`**Suggested fix:** ${issue.fix}`);
        lines.push('');
        if (issue.docs) {
          lines.push(`**Reference:** ${issue.docs}`);
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      });
    }

    if (totalToFix === 0) {
      lines.push(`No issues found. Your repo looks clean — nothing to fix here.`);
      lines.push('');
    }

    // =========================================================================
    // What passed
    // =========================================================================
    if (result.passed.length > 0) {
      lines.push('## What GitCheck already approved');
      lines.push('');
      lines.push(
        `These checks passed. No action needed — but don't accidentally break them while fixing the rest.`
      );
      lines.push('');
      const byCategory: Record<string, string[]> = {};
      for (const checkId of result.passed) {
        const [category] = checkId.split('.');
        if (!byCategory[category]) byCategory[category] = [];
        byCategory[category].push(checkId);
      }
      for (const category of CATEGORY_ORDER) {
        const checks = byCategory[category];
        if (!checks || checks.length === 0) continue;
        lines.push(
          `- **${CATEGORY_TITLES[category] ?? category}**: ${checks.join(', ')}`
        );
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // =========================================================================
    // Deliverable — precise, so the AI knows when to stop
    // =========================================================================
    const firstTier =
      SEVERITIES.find((sev) => issues.some((i) => i.severity === sev)) ?? 'low';
    const firstTierCount = issues.filter((i) => i.severity === firstTier).length;

    lines.push('## What I want back from you');
    lines.push('');
    lines.push(
      `Start with the **${firstTier.toUpperCase()}** issues (${firstTierCount} of them). For each one, show me:`
    );
    lines.push('');
    lines.push(`1. The file and line(s) you'll change.`);
    lines.push(`2. The diff or the exact change.`);
    lines.push(`3. One sentence explaining what changed and why.`);
    lines.push('');
    lines.push(
      `When you finish all ${firstTier.toUpperCase()} issues, **stop and wait for my review** before moving to the next severity tier.`
    );
    lines.push('');
    lines.push(
      `If any issue doesn't apply or the fix would break something, tell me that instead of guessing — I'd rather skip it than have you rewrite code that doesn't need it.`
    );
    lines.push('');

    return lines.join('\n');
  };

  const showHero = !result && !loading;
  const showReport = result && !loading;

  return (
    <>
      <Header />
      <main className="pb-32">
        {showHero && <Hero />}
        {!showHero && <div className="pt-20" />}

        <ScanInput onScan={scan} loading={loading} />

        {loading && <LoadingScan />}

        {error && (
          <div className="container-tight pop">
            <div className="bd bs bg-danger rounded-2xl px-6 py-5 font-bold text-white">
              {error}
            </div>
          </div>
        )}

        {showReport && (
          <div className="container pop space-y-8">
            <ProfileCard result={result} buildFullReport={buildFullReport} />

            <StatGrid
              issues={result.issues.length}
              passed={result.passed.length}
              files={result.fileCount}
            />

            {grouped.length > 0 && (
              <div className="pt-6">
                <h2 className="headline mb-6 text-4xl">The full report</h2>
                <div className="space-y-6">
                  {grouped.map(({ category, issues }) => (
                    <CategorySection
                      key={category}
                      category={category}
                      issues={issues}
                    />
                  ))}
                </div>
              </div>
            )}

            {result.passed.length > 0 && (
              <details className="bd bs-sm rounded-2xl bg-card p-5">
                <summary className="font-bold text-sm">
                  ✓ {result.passed.length} checks passed — see them
                </summary>
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.passed.map((p: string) => (
                    <span
                      key={p}
                      className="rounded-md border px-2.5 py-1 font-mono text-[11px]"
                      style={{
                        borderColor: 'rgba(10,10,10,0.15)',
                        color: '#6b6b6b',
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </main>
    </>
  );
}

// =============================================================================
// Skip-reason lookup — text that reads well inside an AI prompt.
// =============================================================================

function skipReasonFor(category: string): string {
  switch (category) {
    case 'legal':
      return 'Privacy policy, terms, and cookie consent assume real users. If this repo is a library or a learning project, they don\u2019t apply.';
    case 'seo':
      return 'Meta tags, favicons, and sitemaps only matter for pages search engines index. Libraries and APIs aren\u2019t indexed.';
    case 'errors':
      return '404 pages, error boundaries, and empty states only apply to UI projects. This project doesn\u2019t ship a UI.';
    case 'hygiene':
      return 'Standard repo hygiene checks (.Gitignore, README, etc.) were skipped or not applicable.';
    case 'signatures':
      return 'Vibecoded-signature checks were skipped based on project type/purpose.';
    case 'quality':
      return 'Quality checks were skipped.';
    case 'secrets':
    case 'security':
      return 'Secret-scanning was skipped.';
    default:
      return 'Not applicable to this project type.';
  }
}