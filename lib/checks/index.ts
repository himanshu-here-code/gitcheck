import { ScanResult, Issue, RepoContext, Confidence } from '../types';
import { checkLegal } from './legal';
import { checkSEO } from './seo';
import { checkErrorStates } from './errors';
import { checkHygiene } from './hygiene';
import { checkSignatures } from './signatures';
import { checkQuality } from './quality';
import { checkSecrets } from './secrets';
import { detectProjectType, ProjectTypeResult } from '../detect/project-type';
import { detectPurpose, PurposeDetection } from '../detect/purpose';
import { resolveChecks } from '../detect/checks-by-purpose';

// -----------------------------------------------------------------------------
// Scoring
//
//   Raw severity weight × confidence multiplier.
//   Confident issues count fully; subjective patterns barely move the needle.
//   This is what keeps Next.js at ~3% instead of ~10%.
// -----------------------------------------------------------------------------

const WEIGHTS: Record<Issue['severity'], number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
};

const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  high: 1,
  medium: 0.6,
  low: 0.3,
};

type CheckRunner = (
  ctx: RepoContext
) => Promise<{ issues: Issue[]; passed: string[] }>;

const RUNNERS: Record<string, CheckRunner> = {
  legal: checkLegal,
  seo: checkSEO,
  errors: checkErrorStates,
  hygiene: checkHygiene,
  signatures: checkSignatures,
  quality: checkQuality,
  secrets: checkSecrets,
};

const ALL_CHECKS: string[] = [
  'legal',
  'seo',
  'errors',
  'hygiene',
  'signatures',
  'quality',
  'secrets',
];

export async function runAllChecks(ctx: RepoContext): Promise<
  ScanResult & {
    projectType: ProjectTypeResult;
    projectPurpose: PurposeDetection;
    skippedChecks: string[];
  }
> {
  // ---------------------------------------------------------------------------
  // Step 1: Read the README and package.json once
  // ---------------------------------------------------------------------------
  const [readme, pkg] = await Promise.all([
    ctx.getFile('README.md'),
    ctx.getFile('package.json'),
  ]);

  // ---------------------------------------------------------------------------
  // Step 2: Detect type and purpose
  // ---------------------------------------------------------------------------
  const projectType = detectProjectType(
    readme ?? '',
    pkg,
    ctx.files,
    ctx.language.primary,
    ctx.repo,
    ctx.owner
  );
  const projectPurpose = detectPurpose(
    readme ?? '',
    projectType.type,
    ctx.files.length
  );

  // Attach to ctx so downstream checks can read them without extra args
  ctx.projectPurpose = projectPurpose.purpose;
  ctx.projectType = projectType.type;

  // ---------------------------------------------------------------------------
  // Step 3: Resolve which checks to run
  // ---------------------------------------------------------------------------
  const enabledChecks = resolveChecks(projectType.type, projectPurpose.purpose);
  const skippedChecks = ALL_CHECKS.filter((c) => !enabledChecks.includes(c));

  // ---------------------------------------------------------------------------
  // Step 4: Run enabled checks in parallel
  // ---------------------------------------------------------------------------
  const results = await Promise.all(
    enabledChecks.map((name) => RUNNERS[name](ctx))
  );

  // ---------------------------------------------------------------------------
  // Step 5: Aggregate issues and passed checks
  // ---------------------------------------------------------------------------
  const issues: Issue[] = results
    .flatMap((r) => r.issues)
    .sort((a, b) => {
      const aScore = WEIGHTS[a.severity] * CONFIDENCE_MULTIPLIER[a.confidence ?? 'high'];
      const bScore = WEIGHTS[b.severity] * CONFIDENCE_MULTIPLIER[b.confidence ?? 'high'];
      return bScore - aScore;
    });

  const passed: string[] = results.flatMap((r) => r.passed);

  // ---------------------------------------------------------------------------
  // Step 6: Compute score with confidence-weighted severities
  // ---------------------------------------------------------------------------
  const rawScore = issues.reduce((sum, i) => {
    const mult = CONFIDENCE_MULTIPLIER[i.confidence ?? 'high'];
    return sum + WEIGHTS[i.severity] * mult;
  }, 0);
  const score = Math.min(100, Math.round(rawScore));

  const grade =
    score >= 70
      ? 'F'
      : score >= 50
        ? 'D'
        : score >= 30
          ? 'C'
          : score >= 15
            ? 'B'
            : 'A';

  return {
    repo: `${ctx.owner}/${ctx.repo}`,
    score,
    grade,
    issues,
    passed,
    fileCount: ctx.files.length,
    scannedAt: new Date().toISOString(),
    projectType,
    projectPurpose,
    skippedChecks,
  };
}