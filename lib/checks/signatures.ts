import {
  Issue,
  RepoContext,
  Confidence,
  CodeEvidence,
  FileEvidence,
  CodeMatch,
  ContextLine,
} from '../types';
import { ProjectPurpose } from '../detect/purpose';

type Framework =
  | 'django' | 'flask' | 'fastapi' | 'rails' | 'laravel'
  | 'next' | 'vue' | 'react' | 'express';

interface Pattern {
  id: string;
  severity: Issue['severity'];
  confidence?: Confidence;
  title: string;
  description: string;
  fix: string;
  test: RegExp;
  category?: Issue['category'];
  requires?: Framework;
  restrictToFiles?: RegExp;
  requiresAppStructure?: boolean;
  appliesTo?: RegExp;
  skipOnMature?: boolean;
  customMatcher?: (content: string) => boolean;
}

const TS_JS_FILES = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

function isVibecodedGradient(content: string): boolean {
  const purpleFamily = '(purple|pink|indigo|violet|fuchsia)';
  const blocks = content.match(/bg-gradient-to-[a-z]+[^"'`]{0,300}/gi);
  if (!blocks) return false;
  const startRe = new RegExp(`from-${purpleFamily}-\\d+`);
  const endRe = new RegExp(`to-${purpleFamily}-\\d+`);
  return blocks.some((b) => startRe.test(b) && endRe.test(b));
}

const PATTERNS: Pattern[] = [
  // ===========================================================================
  // HIGH-SIGNAL placeholder content
  // ===========================================================================
  {
    id: 'sig.lorem',
    severity: 'high',
    confidence: 'medium',
    title: 'Placeholder text found',
    description: 'Filler content is still in the app. This is the classic sign of a prototype that never got finished.',
    fix: 'Replace with real content specific to your product.',
    test: /(\[your (company|product|name|text)\]|\blorem ipsum\b|\byour text here\b|\binsert your (text|content|tagline)\b)/i,
    skipOnMature: true,
  },
  {
    id: 'sig.placeholderEmail',
    severity: 'medium',
    title: 'Placeholder email addresses in source',
    description: 'Test email addresses like `john@example.com` are still in the code. Real users will see these.',
    fix: 'Replace with real contact addresses or environment-based values.',
    test: /(john|jane|j\.doe|admin|test|user|foo|bar)@(example\.com|test\.com|test\.test|acme\.com|company\.com)/i,
    skipOnMature: true,
  },
  {
    id: 'sig.fakeUserData',
    severity: 'medium',
    title: 'Hardcoded fake user data',
    description: 'User objects with names like "John Doe" or emails like "john@example.com" are hardcoded.',
    fix: 'Move test data to fixtures or seeders. Never hardcode user data in production components.',
    test: /(name\s*:\s*["'](John|Jane)\s+(Doe|Smith)["']|email\s*:\s*["'][^"']*@example\.(com|org)["'])/,
    skipOnMature: true,
  },
  {
    id: 'sig.genericBrand',
    severity: 'medium',
    confidence: 'medium',
    title: 'Generic placeholder brand name',
    description: 'Names like "Acme", "MyApp", "YourApp", or "CompanyName" are still in the code.',
    fix: 'Replace with your real product name everywhere.',
    test: /\b(Acme|MyApp|My App|YourApp|Your App|YourCompany|CompanyName|Company Name|XYZ Corp)\b/,
    skipOnMature: true,
  },
  {
    id: 'sig.comingSoon',
    severity: 'high',
    title: '"Coming soon" / "Under construction" text',
    description: 'A page or feature says "Coming soon".',
    fix: 'Either ship the feature or hide the page until it\u2019s ready.',
    test: /\b(coming soon|under construction|work in progress|stay tuned|launching soon)\b/i,
    skipOnMature: true,
  },

  // ===========================================================================
  // Universal quality issues
  // ===========================================================================
  {
    id: 'sig.localhost',
    severity: 'medium',
    title: 'Hardcoded localhost URLs',
    description: 'Will break in production.',
    fix: 'Use env vars: `process.env.API_URL` (JS), `os.getenv("API_URL")` (Python).',
    test: /(fetch|axios|requests?|url)\s*[\(:]\s*["'`]http:\/\/localhost:\d+/i,
  },
  {
    id: 'sig.apikey',
    severity: 'critical',
    title: 'Hardcoded API key detected',
    description: 'A string matching a known API key format was found.',
    fix: 'Move to env vars immediately and rotate the key at the provider.',
    test: /(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{30,}|AIza[0-9A-Za-z_-]{35})/,
  },
  {
    id: 'sig.nodeSecret',
    severity: 'critical',
    title: 'Hardcoded secret in source',
    description: 'A hardcoded value is assigned to a variable named secret, password, api_key, or access_token.',
    fix: 'Move to env vars immediately and rotate.',
    test: /(secret|password|api_?key|access_?token)\s*[:=]\s*['"][a-zA-Z0-9_\-!@#$%^&*]{20,}['"]/i,
  },
  {
    id: 'sig.commonPassword',
    severity: 'critical',
    title: 'Common test password in source',
    description: 'Passwords like "password123" or "admin" appear in source code.',
    fix: 'Remove immediately. These should never be hardcoded.',
    test: /["'](password123|admin123|letmein|changeme|qwerty123|test123|admin|root)["']/,
  },
  {
    id: 'sig.debugger',
    severity: 'high',
    title: '`debugger` statement in source',
    description: 'A `debugger` statement will pause execution in any browser that has DevTools open.',
    fix: 'Remove before shipping.',
    test: /^\s*debugger\s*;?\s*$/m,
    appliesTo: TS_JS_FILES,
  },
  {
    id: 'sig.builtwith',
    severity: 'low',
    confidence: 'low',
    title: '"Built with ❤️" footer',
    description: 'Reads as template content.',
    fix: 'Replace with something specific to your product, or remove it.',
    test: /built with\s+(❤️|❤|love|next\.js|react|vite|django|flask|rails|laravel|svelte)\b/i,
    skipOnMature: true,
  },

  // ===========================================================================
  // Placeholder / scaffold code
  // ===========================================================================
  {
    id: 'sig.emptyLink',
    severity: 'medium',
    title: 'Placeholder `href="#"` links',
    description: 'Links pointing to `#` are placeholders.',
    fix: 'Point links at real routes or remove them.',
    test: /href\s*=\s*["']#["']/,
    skipOnMature: true,
  },
  {
    id: 'sig.emptyOnClick',
    severity: 'medium',
    title: 'Empty onClick handlers',
    description: 'A button or link has an `onClick` that does nothing.',
    fix: 'Implement the handler or remove the interactive element.',
    test: /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}|onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*null\s*\}/,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },
  {
    id: 'sig.scaffoldComment',
    severity: 'low',
    confidence: 'medium',
    title: 'Scaffold comments left in code',
    description: 'Comments like "// TODO: implement this" are still in the source.',
    fix: 'Implement the feature or remove the placeholder.',
    test: /\/\/\s*(TODO:\s*implement|Your code here|Add your (code|logic|implementation)|implement this|coming soon)/i,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },
  {
    id: 'sig.aiComment',
    severity: 'low',
    confidence: 'low',
    title: 'AI-style explanatory comments',
    description: 'Comments like "// This function handles..." read as AI-generated.',
    fix: 'Remove redundant comments.',
    test: /\/\/\s*(This (function|component|hook|module|helper) (handles|is|will|provides|renders|allows)|We need to|Here we|Now we|Let\u2019s|In this (function|component))/,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },

  // ===========================================================================
  // TypeScript / JS anti-patterns
  // ===========================================================================
  {
    id: 'sig.tsIgnore',
    severity: 'high',
    title: 'TypeScript errors suppressed',
    description: '`@ts-ignore`, `@ts-nocheck`, or `@ts-expect-error` hides real type errors.',
    fix: 'Fix the underlying type error instead of suppressing it.',
    test: /@ts-(ignore|nocheck|expect-error)/,
    appliesTo: /\.(ts|tsx)$/i,
    skipOnMature: true,
  },
  {
    id: 'sig.eslintDisable',
    severity: 'medium',
    confidence: 'low',
    title: 'ESLint rules disabled in source',
    description: 'Blanket `eslint-disable` comments.',
    fix: 'Fix the violation, or add a specific reason after `--`.',
    test: /\/\/\s*eslint-disable(?!-next-line\s+\S+\s+--)/,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },
  {
    id: 'sig.anyType',
    severity: 'medium',
    confidence: 'low',
    title: 'Excessive `any` type usage',
    description: 'Multiple uses of TypeScript\u2019s `any` type.',
    test: /:\s*any\b|as\s+any\b/,
    fix: 'Use `unknown` and narrow, or define a real type.',
    appliesTo: /\.(ts|tsx)$/i,
    skipOnMature: true,
  },
  {
    id: 'sig.nonNullAssertions',
    severity: 'low',
    confidence: 'low',
    title: 'Overuse of non-null assertions',
    description: 'Multiple `!.` assertions in one file.',
    fix: 'Narrow types properly with checks instead of asserting.',
    test: /\w+!\.\w+/,
    appliesTo: /\.(ts|tsx)$/i,
    skipOnMature: true,
  },

  // ===========================================================================
  // AI aesthetic tells
  // ===========================================================================
  {
    id: 'sig.inter',
    severity: 'low',
    confidence: 'low',
    title: 'Using Inter font',
    description: 'Inter is the default in every AI scaffold.',
    fix: 'Try Geist, Satoshi, or a serif for headings.',
    test: /from\s+['"]next\/font\/google['"][\s\S]{0,300}?\bInter(_Tight|_Display)?\b|font-family\s*:\s*['"]?Inter['"]?/i,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },
  {
    id: 'sig.purple',
    severity: 'medium',
    confidence: 'low',
    title: 'AI-style purple/pink gradient',
    description: 'A gradient from one purple-family color to another.',
    fix: 'Pick a real brand color.',
    test: /IMPOSSIBLE/,
    customMatcher: isVibecodedGradient,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },
  {
    id: 'sig.excessiveBackdropBlur',
    severity: 'low',
    confidence: 'low',
    title: 'Overused `backdrop-blur`',
    description: 'Lots of `backdrop-blur` on cards and navbars.',
    fix: 'Use it deliberately. One blurred surface max.',
    test: /(backdrop-blur-[\w-]+[\s\S]{0,500}?){4,}/,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },
  {
    id: 'sig.excessiveShadow2xl',
    severity: 'low',
    confidence: 'low',
    title: 'Overused `shadow-2xl`',
    description: 'Multiple `shadow-2xl` classes.',
    fix: 'Use shadows to establish hierarchy.',
    test: /(shadow-2xl[\s\S]{0,500}?){3,}/,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },
  {
    id: 'sig.excessiveRounded3xl',
    severity: 'low',
    confidence: 'low',
    title: 'Overused `rounded-3xl`',
    description: 'Every element is `rounded-3xl`.',
    fix: 'Vary radius by hierarchy.',
    test: /(rounded-3xl[\s\S]{0,500}?){4,}/,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },
  {
    id: 'sig.emoji',
    severity: 'low',
    confidence: 'low',
    title: 'Emoji-heavy UI',
    description: 'Emojis used as icons.',
    fix: 'Use Lucide, Heroicons, or Phosphor.',
    test: /(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*){5,}/u,
    skipOnMature: true,
  },

  // ===========================================================================
  // Security
  // ===========================================================================
  {
    id: 'sig.dangerous',
    severity: 'high',
    title: 'dangerouslySetInnerHTML used',
    description: "XSS risk if the injected content isn't sanitized.",
    fix: 'Use DOMPurify.sanitize() if you must.',
    test: /dangerouslySetInnerHTML/,
    appliesTo: TS_JS_FILES,
    skipOnMature: true,
  },

  // ===========================================================================
  // Framework-specific
  // ===========================================================================
  {
    id: 'sig.djangoDebugTrue',
    severity: 'critical',
    title: 'Django DEBUG=True in settings',
    description: 'Exposes tracebacks, SQL queries, and env vars.',
    fix: 'Read from env: `DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"`.',
    test: /^\s*DEBUG\s*=\s*True\s*(#.*)?$/m,
    requires: 'django',
    restrictToFiles: /(^|\/)settings[^/]*\.py$/i,
  },
  {
    id: 'sig.djangoSecretKey',
    severity: 'critical',
    title: 'Django SECRET_KEY hardcoded',
    description: 'If it leaks, sessions can be forged.',
    fix: 'Read from env and rotate.',
    test: /SECRET_KEY\s*=\s*['"][a-zA-Z0-9!@#$%^&*()_+\-=]{20,}['"]/,
    requires: 'django',
    restrictToFiles: /(^|\/)settings[^/]*\.py$/i,
  },
  {
    id: 'sig.djangoWelcome',
    severity: 'low',
    title: 'Default Django welcome page',
    description: 'The default welcome page is still shipped.',
    fix: 'Replace with your own landing page.',
    test: /It worked!\s*Congratulations on your first Django-powered page/i,
    requires: 'django',
    requiresAppStructure: true,
  },
  {
    id: 'sig.flaskDebugTrue',
    severity: 'critical',
    title: 'Flask running with debug=True',
    description: 'Exposes the Werkzeug debugger.',
    fix: 'Read from env: `app.run(debug=os.getenv("FLASK_DEBUG") == "1")`.',
    test: /app\.run\([^)]*debug\s*=\s*True/,
    requires: 'flask',
  },
  {
    id: 'sig.flaskSecretKey',
    severity: 'critical',
    title: 'Flask SECRET_KEY hardcoded',
    description: 'Sessions can be forged if this leaks.',
    fix: 'Read from env: `app.secret_key = os.environ["SECRET_KEY"]`.',
    test: /app\.secret_key\s*=\s*['"][a-zA-Z0-9!@#$%^&*()_+\-=]{20,}['"]/,
    requires: 'flask',
  },
  {
    id: 'sig.fastapiCorsAll',
    severity: 'high',
    title: 'FastAPI CORS allows all origins',
    description: 'Any website can make authenticated requests to your API.',
    fix: 'Restrict to specific domains.',
    test: /allow_origins\s*=\s*\[\s*['"]\*['"]\s*\]/,
    requires: 'fastapi',
  },
  {
    id: 'sig.railsSecret',
    severity: 'critical',
    title: 'Rails secret_key_base hardcoded',
    description: 'Rotate immediately if this leaks.',
    fix: 'Read from Rails credentials or an env var.',
    test: /secret_key_base\s*[:=]\s*['"][a-f0-9]{40,}['"]/,
    requires: 'rails',
  },
  {
    id: 'sig.laravelAppDebug',
    severity: 'critical',
    title: 'Laravel APP_DEBUG=true',
    description: 'Exposes environment variables and stack traces.',
    fix: 'Set APP_DEBUG=false in production.',
    test: /APP_DEBUG\s*=\s*true/i,
    requires: 'laravel',
  },
  {
    id: 'sig.nextIgnoreBuildErrors',
    severity: 'high',
    title: 'Next.js ignores TypeScript build errors',
    description: '`ignoreBuildErrors: true` means real type errors ship.',
    fix: 'Remove the flag and fix the errors.',
    test: /ignoreBuildErrors\s*:\s*true/,
    requires: 'next',
  },
  {
    id: 'sig.nextIgnoreEslint',
    severity: 'medium',
    title: 'Next.js ignores ESLint during builds',
    description: '`ignoreDuringBuilds: true` means lint errors ship.',
    fix: 'Remove the flag and fix the lint errors.',
    test: /ignoreDuringBuilds\s*:\s*true/,
    requires: 'next',
  },
];

const PURPOSE_SKIP: Record<ProjectPurpose, string[]> = {
  product: [],
  learning: [
    'sig.djangoWelcome', 'sig.lorem', 'sig.builtwith', 'sig.emoji',
    'sig.comingSoon', 'sig.genericBrand', 'sig.placeholderEmail',
  ],
  portfolio: ['sig.builtwith'],
  docs: ['sig.lorem', 'sig.emoji', 'sig.genericBrand'],
  boilerplate: ['sig.lorem', 'sig.djangoWelcome'],
  experiment: ['sig.lorem', 'sig.builtwith', 'sig.comingSoon'],
  unknown: [],
};

const EXCLUDED_PATH_FRAGMENTS = [
  'node_modules/', '.next/', 'dist/', 'build/', 'out/',
  'venv/', '.venv/', '__pycache__/', 'target/', 'vendor/', 'coverage/',
  'lib/checks/', 'privacy/page', 'terms/page', 'LoadingScan',
  'bench/', 'benchmark/', 'benchmarks/', 'fixtures/', '__tests__/',
  '__fixtures__/', 'test-fixtures/', 'tests/', 'test/',
  '.Github/', 'examples/', 'example/', 'docs/', 'doc/', 'misc/',
  'migrations/', 'samples/',
  'flow-typed/', 'flow/',
  'packages/eslint-plugin-',
  'crates/',
  '.yarn/',
  'scripts/release/',
];

const KNOWN_MATURE_REPOS = new Set([
  'facebook/react', 'facebook/react-native', 'vercel/next.js',
  'vuejs/core', 'vuejs/vue', 'sveltejs/svelte', 'angular/angular',
  'pallets/flask', 'django/django', 'fastapi/fastapi', 'rails/rails',
  'laravel/framework', 'expressjs/express', 'nodejs/node',
  'denoland/deno', 'microsoft/typescript', 'tailwindlabs/tailwindcss',
  'vitejs/vite', 'remix-run/remix', 'withastro/astro', 'nuxt/nuxt',
  'solidjs/solid', 'preactjs/preact', 'sveltejs/kit', 'tanstack/query',
  'reduxjs/redux', 'prisma/prisma', 'honojs/hono', 'nestjs/nest',
  'strapi/strapi', 'sequelize/sequelize',
]);

function isTestFile(path: string): boolean {
  return (
    /_test\.go$/i.test(path) ||
    /^test_.*\.py$/i.test(path) ||
    /_test\.py$/i.test(path) ||
    /Test\.(java|kt)$/i.test(path) ||
    /\.spec\.(ts|tsx|js|jsx|vue|svelte)$/i.test(path) ||
    /\.test\.(ts|tsx|js|jsx|vue|svelte)$/i.test(path) ||
    /_spec\.rb$/i.test(path)
  );
}

function isScannable(path: string, ctx: RepoContext): boolean {
  if (!ctx.lang.sourceExtensions.test(path)) return false;
  if (EXCLUDED_PATH_FRAGMENTS.some((frag) => path.includes(frag))) return false;
  if (isTestFile(path)) return false;
  return true;
}

async function detectFrameworks(ctx: RepoContext): Promise<Set<Framework>> {
  const frameworks = new Set<Framework>();
  const pyManifests = [
    'requirements.txt', 'requirements-dev.txt', 'pyproject.toml',
    'Pipfile', 'setup.py', 'setup.cfg',
  ];
  let pyText = '';
  for (const m of pyManifests) {
    const content = await ctx.getFile(m);
    if (content) pyText += content.toLowerCase() + '\n';
  }

  if (pyText.includes('django') || ctx.fileSet.has('manage.py'))
    frameworks.add('django');
  if (pyText.includes('flask')) frameworks.add('flask');
  if (pyText.includes('fastapi')) frameworks.add('fastapi');

  const hasSettings = ctx.files.some((f) => /(^|\/)settings\.py$/i.test(f));
  const hasDjangoStruct = ctx.files.some((f) =>
    /(^|\/)(urls|wsgi|asgi)\.py$/i.test(f)
  );
  if (hasSettings && hasDjangoStruct) frameworks.add('django');

  const gemfile = await ctx.getFile('Gemfile');
  if (gemfile && /gem\s+['"]rails['"]/i.test(gemfile)) frameworks.add('rails');
  if (
    ctx.fileSet.has('config.ru') &&
    ctx.files.some((f) => /(^|\/)app\/controllers\//.test(f))
  ) {
    frameworks.add('rails');
  }

  const composerJson = await ctx.getFile('composer.json');
  if (composerJson && composerJson.toLowerCase().includes('laravel/framework'))
    frameworks.add('laravel');

  const pkgJson = await ctx.getFile('package.json');
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson);
      const deps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };
      if (deps['next']) frameworks.add('next');
      if (deps['vue'] || deps['nuxt']) frameworks.add('vue');
      if (deps['react'] || deps['react-dom']) frameworks.add('react');
      if (deps['express'] || deps['fastify'] || deps['koa'])
        frameworks.add('express');
    } catch {}
  }

  return frameworks;
}

function hasAppEntryPoint(files: string[]): boolean {
  const patterns = [
    /^app\.py$/i, /^main\.py$/i, /^server\.py$/i, /^application\.py$/i,
    /^wsgi\.py$/i, /^asgi\.py$/i, /^manage\.py$/i, /^run\.py$/i,
    /^src\/app\.py$/i, /^src\/main\.py$/i,
  ];
  return files.some((f) => patterns.some((p) => p.test(f)));
}

// =============================================================================
// Evidence extraction
// =============================================================================

const MAX_FILES_WITH_EVIDENCE = 3;
const MAX_MATCHES_PER_FILE = 5;
const MAX_LINE_LENGTH = 200;
const CONTEXT_LINES = 5;

function countRealMatches(content: string, pattern: Pattern): number {
  if (pattern.customMatcher) {
    const blocks = content.match(/bg-gradient-to-[a-z]+[^"'`]{0,300}/gi);
    return blocks ? blocks.length : 0;
  }
  const flags = pattern.test.flags.includes('g')
    ? pattern.test.flags
    : pattern.test.flags + 'g';
  const global = new RegExp(pattern.test.source, flags);
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = global.exec(content)) !== null) {
    if (m[0].length === 0) {
      global.lastIndex++;
      continue;
    }
    count++;
    if (count > 1000) break;
  }
  return count;
}

/**
 * Extracts specific line numbers and builds a 5-line block around them.
 * Fixed mapping to prevent duplicate/infinite loops.
 */
function extractFileEvidence(
  content: string,
  file: string,
  pattern: Pattern
): FileEvidence | null {
  const lines = content.split('\n');
  const matches: CodeMatch[] = [];
  const seenLines = new Set<number>();

  // Pre-calculate line start indices to avoid slicing the whole file repeatedly
  const lineStartIndices = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') lineStartIndices.push(i + 1);
  }

  const pushMatch = (m: RegExpExecArray) => {
    if (matches.length >= MAX_MATCHES_PER_FILE) return;

    // Find which line this match started on (1-indexed)
    let lineIndex = 0;
    while (
      lineIndex + 1 < lineStartIndices.length &&
      lineStartIndices[lineIndex + 1] <= m.index
    ) {
      lineIndex++;
    }
    const lineNumber = lineIndex + 1;

    // Deduplicate by line number
    if (seenLines.has(lineNumber)) return;
    seenLines.add(lineNumber);

    const lineText = lines[lineIndex] ?? '';
    const colInLine = m.index - lineStartIndices[lineIndex];
    const start = Math.max(0, colInLine);
    const end = Math.min(lineText.length, start + m[0].length);

    const displayText =
      lineText.length > MAX_LINE_LENGTH
        ? lineText.slice(0, MAX_LINE_LENGTH)
        : lineText;
    const displayEnd = Math.min(end, displayText.length);

    const context: ContextLine[] = [];
    const startLine = Math.max(1, lineNumber - CONTEXT_LINES);
    const endLine = Math.min(lines.length, lineNumber + CONTEXT_LINES);

    for (let i = startLine; i <= endLine; i++) {
      const isMatch = i === lineNumber;
      const rawLine = lines[i - 1] ?? '';
      const truncated = rawLine.length > MAX_LINE_LENGTH
        ? rawLine.slice(0, MAX_LINE_LENGTH) + '…'
        : rawLine;
      
      context.push({
        line: i,
        text: isMatch ? displayText : truncated,
        isMatch,
      });
    }

    matches.push({
      line: lineNumber,
      text: displayText,
      matchStart: start,
      matchEnd: displayEnd,
      context,
    });
  };

  if (pattern.customMatcher) {
    const gradientRe = /bg-gradient-to-[a-z]+[^"'`]{0,300}/gi;
    let m: RegExpExecArray | null;
    while ((m = gradientRe.exec(content)) !== null) {
      pushMatch(m);
      if (matches.length >= MAX_MATCHES_PER_FILE) break;
    }
  } else {
    const flags = pattern.test.flags.includes('g')
      ? pattern.test.flags
      : pattern.test.flags + 'g';
    const global = new RegExp(pattern.test.source, flags);
    let m: RegExpExecArray | null;
    while ((m = global.exec(content)) !== null) {
      if (m[0].length === 0) {
        global.lastIndex++;
        continue;
      }
      pushMatch(m);
      if (matches.length >= MAX_MATCHES_PER_FILE) break;
      if (global.lastIndex === m.index) {
        global.lastIndex = m.index + 1;
      }
    }
  }

  if (matches.length === 0) return null;

  return {
    file,
    matches,
    truncated:
      matches.length === MAX_MATCHES_PER_FILE &&
      countRealMatches(content, pattern) > MAX_MATCHES_PER_FILE,
  };
}

// =============================================================================
// Main Check
// =============================================================================

export async function checkSignatures(ctx: RepoContext): Promise<{
  issues: Issue[];
  passed: string[];
}> {
  const issues: Issue[] = [];
  const passed: string[] = [];

  const purpose = ctx.projectPurpose as ProjectPurpose | undefined;
  const skippedIds = new Set<string>(
    purpose ? PURPOSE_SKIP[purpose] ?? [] : []
  );

  const frameworks = await detectFrameworks(ctx);
  const hasAppEntry = hasAppEntryPoint(ctx.files);

  const repoKey = `${ctx.owner}/${ctx.repo}`.toLowerCase();
  const isMatureRepo = KNOWN_MATURE_REPOS.has(repoKey);

  const sourceFiles = ctx.files.filter((f) => isScannable(f, ctx));
  const sample = sourceFiles.slice(0, 100);

  const matchedFiles = new Map<string, string[]>();
  const matchedEvidence = new Map<string, CodeEvidence>();

  for (const f of sample) {
    const content = await ctx.getFile(f);
    if (!content) continue;

    for (const pattern of PATTERNS) {
      if (skippedIds.has(pattern.id)) continue;
      if (pattern.requires && !frameworks.has(pattern.requires)) continue;
      if (pattern.restrictToFiles && !pattern.restrictToFiles.test(f)) continue;
      if (pattern.requiresAppStructure && !hasAppEntry) continue;
      if (pattern.appliesTo && !pattern.appliesTo.test(f)) continue;
      if (isMatureRepo && pattern.skipOnMature) continue;

      let hit = false;
      if (pattern.customMatcher) {
        hit = pattern.customMatcher(content);
      } else {
        pattern.test.lastIndex = 0;
        hit = pattern.test.test(content);
      }

      if (hit) {
        if (!matchedFiles.has(pattern.id)) matchedFiles.set(pattern.id, []);
        matchedFiles.get(pattern.id)!.push(f);

        const existing = matchedEvidence.get(pattern.id) ?? [];
        if (existing.length < MAX_FILES_WITH_EVIDENCE) {
          const fileEvidence = extractFileEvidence(content, f, pattern);
          if (fileEvidence) {
            existing.push(fileEvidence);
            matchedEvidence.set(pattern.id, existing);
          }
        }
      }
    }
  }

  for (const pattern of PATTERNS) {
    if (skippedIds.has(pattern.id)) {
      passed.push(pattern.id);
      continue;
    }
    if (pattern.requires && !frameworks.has(pattern.requires)) {
      passed.push(pattern.id);
      continue;
    }
    if (pattern.requiresAppStructure && !hasAppEntry) {
      passed.push(pattern.id);
      continue;
    }
    if (isMatureRepo && pattern.skipOnMature) {
      passed.push(pattern.id);
      continue;
    }

    const files = matchedFiles.get(pattern.id) ?? [];

    if (files.length > 0) {
      issues.push({
        id: pattern.id,
        category: pattern.category ?? 'signatures',
        severity: pattern.severity,
        confidence: pattern.confidence,
        title:
          pattern.title +
          (files.length > 1 ? ` (${files.length} files)` : ''),
        description: pattern.description,
        fix: pattern.fix,
        affectedFiles: files.slice(0, 5),
        evidence: matchedEvidence.get(pattern.id),
      });
    } else {
      passed.push(pattern.id);
    }
  }

  return { issues, passed };
}