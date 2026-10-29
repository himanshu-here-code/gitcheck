import { ProjectType } from './project-type';

export type ProjectPurpose =
  | 'product'
  | 'learning'
  | 'portfolio'
  | 'docs'
  | 'boilerplate'
  | 'experiment'
  | 'unknown';

export interface PurposeDetection {
  purpose: ProjectPurpose;
  confidence: number;
  signals: string[];
}

/**
 * Determine WHY this repo exists.
 *
 * Only analyzes the first 1000 chars of the README. The top is where
 * intent lives — the rest is usually docs, tutorials, API reference.
 *
 * Detection strategy:
 *   - "Strong" signals are words that only appear in real products.
 *     ONE strong signal is enough to call it a product.
 *   - "Weak" signals appear in tutorials, libraries, and products alike.
 *     TWO weak signals are needed, never just one.
 *   - Explicit intent (learning, portfolio, boilerplate, experiment)
 *     is preferred over "product" because it's usually stated outright.
 *   - When in doubt, return `unknown`. An honest `unknown` beats a
 *     confident `product` that flags missing privacy policies on a
 *     tutorial repo.
 */
export function detectPurpose(
  readme: string,
  projectType: ProjectType,
  fileCount: number
): PurposeDetection {
  const fullText = readme ?? '';
  const text = fullText.slice(0, 1000).toLowerCase();
  const signals: string[] = [];

  // ---------------------------------------------------------------------------
  // Docs type → docs purpose (locked, no ambiguity)
  // ---------------------------------------------------------------------------
  if (projectType === 'docs') {
    signals.push('project type is docs');
    return { purpose: 'docs', confidence: 0.95, signals };
  }

  // ---------------------------------------------------------------------------
  // 1. Learning — needs 2 strong signals
  // ---------------------------------------------------------------------------
  const learningSignals: Array<[string, RegExp]> = [
    ['N days/weeks/months of', /\b\d+\s*(day|week|month)s?\s+of\b/i],
    ['learning X tutorial', /\b(learn|learning) (python|javascript|react|programming|to code|rust|go|typescript)\b/i],
    ['tutorial/course keyword', /\b(tutorial series|course materials|curriculum|bootcamp|course)\b/i],
    ['for beginners', /\b(for beginners|beginner['']?s? (guide|tutorial))\b/i],
    ['hands-on tutorial', /\bhands[- ]on (tutorial|guide|course)\b/i],
  ];
  const learningHits = learningSignals
    .filter(([, re]) => re.test(text))
    .map(([label]) => label);
  if (learningHits.length >= 2) {
    signals.push(...learningHits);
    return { purpose: 'learning', confidence: 0.9, signals };
  }

  // ---------------------------------------------------------------------------
  // 2. Portfolio — needs 2 signals
  // ---------------------------------------------------------------------------
  const portfolioSignals: Array<[string, RegExp]> = [
    ['portfolio / personal site', /\b(portfolio|personal (site|website|blog)|my (site|website|blog))\b/i],
    ['showcase of projects', /\b(showcase|projects? i('ve| have) (built|made|worked on))\b/i],
    ['about me / hire me', /\b(about me|hire me|resume|curriculum vitae)\b/i],
  ];
  const portfolioHits = portfolioSignals
    .filter(([, re]) => re.test(text))
    .map(([label]) => label);
  if (portfolioHits.length >= 2) {
    signals.push(...portfolioHits);
    return { purpose: 'portfolio', confidence: 0.85, signals };
  }

  // ---------------------------------------------------------------------------
  // 3. Boilerplate — needs 2 signals
  // ---------------------------------------------------------------------------
  const boilerplateSignals: Array<[string, RegExp]> = [
    ['boilerplate/template keyword', /\b(boilerplate|starter|template|scaffold|kickstart|skeleton)\b/i],
    ['clone/use this template', /\b(clone this template|use this template|fork and customize)\b/i],
    ['create from this template', /\b(create .* from this template)\b/i],
  ];
  const boilerplateHits = boilerplateSignals
    .filter(([, re]) => re.test(text))
    .map(([label]) => label);
  if (boilerplateHits.length >= 2) {
    signals.push(...boilerplateHits);
    return { purpose: 'boilerplate', confidence: 0.9, signals };
  }

  // ---------------------------------------------------------------------------
  // 4. Product — strong vs. weak signals
  //
  //    Strong: something only a real product says.
  //    Weak:   something that could be in a tutorial, library, or product.
  // ---------------------------------------------------------------------------

  // Strong signals — 1 is enough
  const strongProductSignals: Array<[string, RegExp]> = [
    ['signup/login/pricing', /\b(sign up|signup|log in|login|pricing|subscription|saas|free trial)\b/i],
    ['privacy/terms mentioned', /\b(privacy policy|terms of service)\b/i],
    ['dashboard/product CTA', /\b(dashboard|get started|try it now|scan your|paste a|your app)\b/i],
  ];

  // Weak signals — 2+ needed
  const weakProductSignals: Array<[string, RegExp]> = [
    ['users/accounts/teams', /\b(users|accounts|customers|teams|organizations|workspaces)\b/i],
    ['product adjectives', /\b(production[- ]ready|high[- ]performance|fast|secure|reliable|modern)\b/i],
    ['framework/library nouns', /\b(framework|library|sdk|package|toolkit|api)\b/i],
  ];

  const isProductType =
    projectType === 'web-app' ||
    projectType === 'api-service' ||
    projectType === 'mobile-app' ||
    projectType === 'library' ||
    projectType === 'cli-tool';

  if (isProductType) {
    const strongHits = strongProductSignals
      .filter(([, re]) => re.test(text))
      .map(([label]) => label);
    if (strongHits.length >= 1) {
      signals.push(...strongHits);
      return { purpose: 'product', confidence: 0.85, signals };
    }

    const weakHits = weakProductSignals
      .filter(([, re]) => re.test(text))
      .map(([label]) => label);
    if (weakHits.length >= 2) {
      signals.push(...weakHits);
      return { purpose: 'product', confidence: 0.65, signals };
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Experiment — needs 2 signals
  // ---------------------------------------------------------------------------
  const experimentSignals: Array<[string, RegExp]> = [
    ['experiment/scratch keyword', /\b(experiment(al)? (project|repo|codebase|thing)|scratch|playground|sandbox|just testing)\b/i],
    ['PoC keyword', /\b(poc|proof[- ]of[- ]concept)\b/i],
    ['misc/assorted', /\b(misc|assorted)\b/i],
  ];
  const experimentHits = experimentSignals
    .filter(([, re]) => re.test(text))
    .map(([label]) => label);
  if (experimentHits.length >= 2) {
    signals.push(...experimentHits);
    return { purpose: 'experiment', confidence: 0.8, signals };
  }

  // ---------------------------------------------------------------------------
  // 6. Fallbacks
  //
  //    When we don't have enough evidence to call it a product, we DO NOT
  //    silently upgrade to product. That was the bug. Return `unknown` with
  //    low confidence, and let the routing layer decide not to run
  //    product-only checks (legal, etc.).
  // ---------------------------------------------------------------------------
  if (projectType === 'library' || projectType === 'cli-tool') {
    signals.push('library/cli with no explicit purpose — assuming general use');
    return { purpose: 'product', confidence: 0.5, signals };
  }

  if (isProductType) {
    signals.push('app-like type, no strong purpose signals');
    return { purpose: 'unknown', confidence: 0.4, signals };
  }

  if (fileCount < 20 && fullText.length < 400) {
    signals.push('small repo, minimal README');
    return { purpose: 'experiment', confidence: 0.55, signals };
  }

  signals.push('no strong signals');
  return { purpose: 'unknown', confidence: 0.4, signals };
}