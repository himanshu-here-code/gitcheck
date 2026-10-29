import { Issue, RepoContext } from '../types';

// =============================================================================
// Constants
// =============================================================================

const DYNAMIC_LANGUAGES = new Set(['javascript', 'python', 'ruby', 'php']);

const LEGitIMATELY_LARGE_BASENAMES = new Set([
  'app.py', 'main.py', 'main.go', 'main.rs', 'lib.rs',
  'index.ts', 'index.tsx', 'index.js', 'index.jsx',
  'app.ts', 'server.ts', 'server.js',
  'router.ts', 'router.js', 'routes.ts', 'routes.js',
  'schema.ts', 'schema.js',
  'urql.ts', 'worker.ts', 'worker.js',
]);

const FRAMEWORK_PATH_FRAGMENTS = [
  'framework/', 'internal/', 'vendor/', 'generated/',
  '__generated__/', '.generated/', 'compiled/', 'dist/', 'build/',
];

const MAX_FILE_LINES = { dynamic: 1500, static: 2500 } as const;
const MAX_MASSIVE_LINES = 5000;

// =============================================================================
// Main check
// =============================================================================

export async function checkQuality(ctx: RepoContext): Promise<{
  issues: Issue[];
  passed: string[];
}> {
  const issues: Issue[] = [];
  const passed: string[] = [];
  const { language } = ctx;

  const isJS =
    language.primary === 'typescript' || language.primary === 'javascript';

  const sourceFiles = ctx.files.filter(
    (f) =>
      ctx.lang.sourceExtensions.test(f) &&
      !isBuildPath(f) &&
      !isTestFile(f)
  );

  const htmlFiles = ctx.files.filter(
    (f) =>
      /\.html?$/i.test(f) &&
      !isBuildPath(f) &&
      !f.includes('doc/') &&
      !f.includes('docs/')
  );

  // ---------------------------------------------------------------------------
  // 1. Images without alt text
  // ---------------------------------------------------------------------------
  {
    const offendingFiles: string[] = [];
    const imgTagRe = /<img\s+[^>]*src=[^>]*\/?>/g;
    const altRe = /\balt\s*=/;

    const scanForMissingAlt = (content: string): boolean => {
      const matches = content.match(imgTagRe);
      if (!matches) return false;
      return matches.some((tag) => !altRe.test(tag));
    };

    const ordered = [...sourceFiles].sort((a, b) => b.length - a.length);

    for (const f of ordered.slice(0, 50)) {
      const content = await ctx.getFile(f);
      if (content && scanForMissingAlt(content)) offendingFiles.push(f);
    }

    for (const f of htmlFiles.slice(0, 25)) {
      const content = await ctx.getFile(f);
      if (content && scanForMissingAlt(content)) offendingFiles.push(f);
    }

    if (offendingFiles.length > 0) {
      issues.push({
        id: 'quality.imgAlt',
        category: 'quality',
        severity: 'medium',
        confidence: 'medium',
        title: `Images missing alt text (${offendingFiles.length} file${offendingFiles.length > 1 ? 's' : ''})`,
        description:
          'Images without alt text are invisible to screen readers and hurt accessibility.',
        fix: 'Add a descriptive `alt` attribute to every `<img>`. For decorative images, use `alt=""`.',
        docs: 'https://web.dev/learn/accessibility/images',
        affectedFiles: offendingFiles.slice(0, 5),
      });
    } else {
      passed.push('quality.imgAlt');
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Multiple lockfiles
  // ---------------------------------------------------------------------------
  {
    const lockfiles = [
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock',
    ].filter((name) => ctx.fileSet.has(name));

    if (lockfiles.length > 1) {
      issues.push({
        id: 'quality.multipleLockfiles',
        category: 'quality',
        severity: 'medium',
        title: `Multiple lockfiles (${lockfiles.join(', ')})`,
        description:
          'Different developers may use different package managers. Inconsistent installs.',
        fix:
          'Pick one package manager and delete the others. Add the others to .Gitignore.',
        affectedFiles: lockfiles,
      });
    } else {
      passed.push('quality.multipleLockfiles');
    }
  }

  // ---------------------------------------------------------------------------
  // 3. No Node version pin
  // ---------------------------------------------------------------------------
  if (isJS) {
    const pkg = await ctx.getFile('package.json');
    if (pkg) {
      const hasNvmrc = ctx.fileSet.has('.nvmrc');
      const hasNodeVersion = ctx.fileSet.has('.node-version');
      const hasToolVersions = ctx.fileSet.has('.tool-versions');
      const pkgHasEngines = /"engines"\s*:/.test(pkg);

      if (!hasNvmrc && !hasNodeVersion && !hasToolVersions && !pkgHasEngines) {
        issues.push({
          id: 'quality.nodeVersion',
          category: 'quality',
          severity: 'low',
          title: 'No Node version specified',
          description:
            'New contributors and CI will guess which Node version to use.',
          fix:
            'Add a `.nvmrc` file with your Node version (e.g., `20.11.0`), or add `"engines": { "node": ">=20" }` to package.json.',
        });
      } else {
        passed.push('quality.nodeVersion');
      }
    } else {
      passed.push('quality.nodeVersion');
    }
  } else {
    passed.push('quality.nodeVersion');
  }

  // ---------------------------------------------------------------------------
  // 4. Unused dependencies — DISABLED
  //
  // High false-positive rate without lockfile analysis. Any heuristic flags
  // leGit deps used via CLI, config plugins, transitively, or as peers.
  // A wrong call here ("husky is unused") destroys credibility. Skip
  // entirely; revisit post-launch with proper AST-based resolution.
  // ---------------------------------------------------------------------------
  passed.push('quality.unusedDeps');

  // ---------------------------------------------------------------------------
  // 5. Large source files (language-aware threshold)
  // ---------------------------------------------------------------------------
  {
    const threshold = DYNAMIC_LANGUAGES.has(language.primary)
      ? MAX_FILE_LINES.dynamic
      : MAX_FILE_LINES.static;

    const offenders: { file: string; lines: number }[] = [];

    for (const f of sourceFiles.slice(0, 100)) {
      if (isProseFile(f)) continue;
      if (isLeGitimatelyLarge(f)) continue;

      const content = await ctx.getFile(f);
      if (!content) continue;

      const lines = content.split('\n').length;
      if (lines > threshold) offenders.push({ file: f, lines });
    }

    if (offenders.length > 0) {
      const hasMassive = offenders.some((o) => o.lines > MAX_MASSIVE_LINES);
      issues.push({
        id: 'quality.massiveFiles',
        category: 'quality',
        severity: hasMassive ? 'medium' : 'low',
        confidence: 'medium',
        title: `Very large source file${offenders.length > 1 ? 's' : ''} (${offenders.length})`,
        description: `These files exceed ${threshold.toLocaleString()} lines: ${offenders
          .slice(0, 5)
          .map((o) => `${o.file} (${o.lines})`)
          .join(', ')}${offenders.length > 5 ? ` and ${offenders.length - 5} more` : ''}.`,
        fix: 'Split large files into smaller modules by responsibility. Route handlers, business logic, and data fetching are usually separable.',
        affectedFiles: offenders.slice(0, 5).map((o) => o.file),
      });
    } else {
      passed.push('quality.massiveFiles');
    }
  }

  // ---------------------------------------------------------------------------
  // 6. TODO/FIXME density (all comment syntaxes)
  // ---------------------------------------------------------------------------
  {
    const offenders: { file: string; count: number }[] = [];

    for (const f of sourceFiles.slice(0, 60)) {
      const content = await ctx.getFile(f);
      if (!content) continue;

      const matches = content.match(
        /(?:\/\/|#|--|<!--|\/\*)\s*(?:TODO|FIXME|XXX|HACK)\b/gi
      );
      const count = matches ? matches.length : 0;
      if (count >= 3) offenders.push({ file: f, count });
    }

    if (offenders.length > 0) {
      const total = offenders.reduce((s, o) => s + o.count, 0);
      issues.push({
        id: 'quality.todoDensity',
        category: 'quality',
        severity: 'low',
        title: `${total} TODO/FIXME comments across ${offenders.length} file${offenders.length > 1 ? 's' : ''}`,
        description: 'Comments like TODO and FIXME signal unfinished work.',
        fix: 'Address the TODOs or convert them to GitHub issues.',
        affectedFiles: offenders.slice(0, 5).map((o) => o.file),
      });
    } else {
      passed.push('quality.todoDensity');
    }
  }

  return { issues, passed };
}

// =============================================================================
// Helpers
// =============================================================================

function isBuildPath(path: string): boolean {
  return (
    path.includes('node_modules') ||
    path.includes('.next') ||
    path.includes('dist/') ||
    path.includes('build/') ||
    path.includes('out/') ||
    path.includes('venv/') ||
    path.includes('.venv/') ||
    path.includes('__pycache__/') ||
    path.includes('coverage/') ||
    path.includes('target/')
  );
}

function isTestFile(path: string): boolean {
  return /_test\.go$|_test\.py$|^test_.*\.py$|\.spec\.|\.test\./i.test(path);
}

function isProseFile(path: string): boolean {
  return /\.(html?|md|mdx|rst|txt|css|scss|sass|less|json|yaml|yml|toml)$/i.test(
    path
  );
}

function isLeGitimatelyLarge(path: string): boolean {
  if (FRAMEWORK_PATH_FRAGMENTS.some((frag) => path.includes(frag))) return true;

  const basename = (path.split('/').pop() ?? '').toLowerCase();
  if (LEGitIMATELY_LARGE_BASENAMES.has(basename)) return true;

  return false;
}