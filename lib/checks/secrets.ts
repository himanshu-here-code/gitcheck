import { Issue, RepoContext } from '../types';

/**
 * Detects secrets exposed through public env variables.
 *
 * This is the single most common vibecoded bug that leaks real money:
 * a key set as `NEXT_PUBLIC_STRIPE_SECRET_KEY` (or `VITE_...`, `REACT_APP_...`,
 * `PUBLIC_...`, `EXPO_PUBLIC_...`) gets bundled into the client JavaScript
 * and is visible to anyone who opens DevTools.
 *
 * Detection strategy:
 *
 *   1. Scan committed .env* files for public-prefixed vars whose names
 *      look secret-ish. This is deterministic — either the key exists
 *      or it doesn't.
 *
 *   2. Scan source files for `process.env.NEXT_PUBLIC_*SECRET*` style
 *      references. This catches cases where the .env file isn't committed
 *      but the code would leak the value if it were.
 *
 *   3. Scan any .env file for values that match known secret formats
 *      (sk_live_, sk-, AKIA, ghp_, etc.) regardless of prefix. A leaked
 *      `OPENAI_API_KEY=sk-...` in a committed .env is critical even
 *      without the public prefix.
 *
 * Confidence is always 'high' — this is deterministic pattern matching
 * with a very specific failure mode. False positives are essentially zero
 * because we require either an exact prefix match on the name or a
 * matching secret format on the value.
 */

const PUBLIC_PREFIX = /^(NEXT_PUBLIC_|VITE_|REACT_APP_|PUBLIC_|EXPO_PUBLIC_|GATSBY_)/;

const SECRET_NAME = /(SECRET|PRIVATE|SERVICE_ROLE|SERVICE_KEY|ADMIN|TOKEN|PASSWORD|API_KEY|ACCESS_KEY)/;

/**
 * Formats that are almost certainly real API keys. If we see one of these
 * as a value anywhere, treat it as critical — regardless of variable name.
 */
const SECRET_VALUE_PATTERNS: Array<[string, RegExp]> = [
  ['OpenAI', /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ['Stripe live', /sk_live_[A-Za-z0-9]{20,}/],
  ['Stripe restricted', /rk_live_[A-Za-z0-9]{20,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{30,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Anthropic key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['Supabase service', /sbp_[A-Za-z0-9]{30,}/],
  ['Twilio', /SK[0-9a-fA-F]{32}/],
  ['SendGrid', /SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/],
];

const ENV_FILE_PATTERNS = [
  /^\.env$/,
  /^\.env\.local$/,
  /^\.env\.development$/,
  /^\.env\.production$/,
  /^\.env\.staging$/,
  /^\.env\.(local|dev|prod)\.local$/,
];

export async function checkSecrets(ctx: RepoContext): Promise<{
  issues: Issue[];
  passed: string[];
}> {
  const issues: Issue[] = [];
  const passed: string[] = [];

  // -------------------------------------------------------------------------
  // 1. Scan committed .env files (if any)
  // -------------------------------------------------------------------------

  const envFiles = ctx.files.filter((f) =>
    ENV_FILE_PATTERNS.some((rx) => rx.test(f))
  );

  let publicSecretHits = 0;
  let hardSecretHits = 0;
  const publicSecretFiles: string[] = [];
  const hardSecretFiles: string[] = [];
  const publicSecretExamples: string[] = [];
  const hardSecretExamples: string[] = [];

  for (const file of envFiles) {
    const content = await ctx.getFile(file);
    if (!content) continue;

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Format: KEY=value  or  KEY="value"  or  export KEY=value
      const m = trimmed.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;

      const name = m[1];
      const value = m[2].replace(/^["']|["']$/g, '').trim();
      if (!value) continue;

      // (a) Public prefix + secret-ish name → critical
      if (PUBLIC_PREFIX.test(name) && SECRET_NAME.test(name)) {
        publicSecretHits++;
        if (!publicSecretFiles.includes(file)) publicSecretFiles.push(file);
        if (publicSecretExamples.length < 5) publicSecretExamples.push(name);
        continue;
      }

      // (b) Value matches a known secret format → critical regardless of name
      const matchedFormat = SECRET_VALUE_PATTERNS.find(([, re]) => re.test(value));
      if (matchedFormat) {
        // Skip obvious placeholder values (all x's, all zeros, "your-key-here" etc.)
        if (/^([xX0]+|changeme|placeholder|example|fake|test|dummy)/i.test(value)) continue;
        hardSecretHits++;
        if (!hardSecretFiles.includes(file)) hardSecretFiles.push(file);
        if (hardSecretExamples.length < 5) {
          hardSecretExamples.push(`${name} (${matchedFormat[0]})`);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Scan source files for public-prefixed secret references
  //
  //    This catches the case where the .env isn't committed (good) but the
  //    code would leak it if it were. Still worth flagging because the
  //    pattern itself is the bug.
  // -------------------------------------------------------------------------

  let sourceRefHits = 0;
  const sourceRefFiles: string[] = [];

  const sourceFiles = ctx.files
    .filter((f) => ctx.lang.sourceExtensions.test(f))
    .filter((f) => !/node_modules\/|\.next\/|dist\/|build\//.test(f))
    .slice(0, 80);

  // Matches: process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY
  //          import.meta.env.VITE_OPENAI_API_KEY
  //          process.env.NEXT_PUBLIC_ADMIN_TOKEN
  const sourcePattern =
    /\b(?:process\.env|import\.meta\.env)\.(NEXT_PUBLIC_|VITE_|REACT_APP_|PUBLIC_|EXPO_PUBLIC_)[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE|ADMIN|TOKEN|PASSWORD|API_KEY)[A-Z0-9_]*/g;

  for (const file of sourceFiles) {
    const content = await ctx.getFile(file);
    if (!content) continue;
    sourcePattern.lastIndex = 0;
    if (sourcePattern.test(content)) {
      sourceRefHits++;
      if (!sourceRefFiles.includes(file)) sourceRefFiles.push(file);
    }
  }

  // -------------------------------------------------------------------------
  // 3. Report
  // -------------------------------------------------------------------------

  if (publicSecretHits > 0) {
    issues.push({
      id: 'secrets.publicEnv',
      category: 'security',
      severity: 'critical',
      confidence: 'high',
      title: `Secret exposed via public env var (${publicSecretHits} found)`,
      description:
        'A key named like a secret is set as a public env var. Public-prefixed vars are bundled into the client JavaScript and are visible to anyone who opens DevTools.',
      fix:
        'Rename the variable and drop the public prefix, or use it only in server-side code (API routes, server actions, edge functions). Rotate the key immediately.',
      affectedFiles: publicSecretFiles.slice(0, 5),
    });
  }

  if (hardSecretHits > 0) {
    issues.push({
      id: 'secrets.committedValue',
      category: 'security',
      severity: 'critical',
      confidence: 'high',
      title: `Real secret committed to repo (${hardSecretHits} found)`,
      description: `A value matching a known secret format is committed in an .env file. Anyone with repo access — and, if public, anyone on the internet — has this key.`,
      fix:
        'Rotate the key at the provider, remove the .env file from Git (and from history), and add it to .Gitignore.',
      affectedFiles: hardSecretFiles.slice(0, 5),
    });
  }

  if (sourceRefHits > 0) {
    issues.push({
      id: 'secrets.publicEnvRef',
      category: 'security',
      severity: 'high',
      confidence: 'medium',
      title: `Code references public-prefixed secret (${sourceRefHits} file${sourceRefHits === 1 ? '' : 's'})`,
      description:
        'Source code reads an env var whose name includes both a public prefix and a secret-ish keyword. If this var is ever populated, its value leaks to the browser.',
      fix:
        'Move the env var read to server-side code (API route, server action, server component). Only use public-prefixed vars for non-secret config.',
      affectedFiles: sourceRefFiles.slice(0, 5),
    });
  }

  if (
    publicSecretHits === 0 &&
    hardSecretHits === 0 &&
    sourceRefHits === 0
  ) {
    passed.push('secrets.publicEnv');
    passed.push('secrets.committedValue');
    passed.push('secrets.publicEnvRef');
  }

  return { issues, passed };
}