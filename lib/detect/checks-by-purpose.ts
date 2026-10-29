import { ProjectType } from './project-type';
import { ProjectPurpose } from './purpose';

/**
 * Decide which check categories to run for a given (type, purpose) pair.
 *
 * Purpose overrides type when specific (learning, docs, boilerplate, etc.).
 * Otherwise the type's defaults apply.
 *
 * Rationale per category:
 *   - legal:    privacy, terms, contact — only for user-facing products
 *   - seo:      meta tags, OG images, sitemaps — only for indexed web pages
 *   - errors:   404, error boundaries, empty states — only for UIs
 *   - hygiene:  .Gitignore, .env.example, README — universal
 *   - signatures: placeholder text, gradients, hardcoded secrets — universal
 *   - quality:  unused deps, alt text, TODOs — universal
 *   - secrets:  public-env leaks, committed keys — universal (safety net)
 */
export function resolveChecks(
  type: ProjectType,
  purpose: ProjectPurpose
): string[] {
  // ===========================================================================
  // Purpose overrides (highest priority)
  // ===========================================================================
  switch (purpose) {
    case 'learning':
      return ['hygiene', 'signatures', 'quality', 'secrets'];

    case 'experiment':
      return ['signatures', 'quality', 'secrets'];

    case 'portfolio':
      // No legal — portfolio sites don't need privacy pages.
      return ['seo', 'errors', 'signatures', 'quality', 'secrets'];

    case 'docs':
      return ['seo', 'quality', 'secrets'];

    case 'boilerplate':
      return ['legal', 'hygiene', 'signatures', 'quality', 'secrets'];

    // 'product' and 'unknown' fall through to type-based rules
  }

  // ===========================================================================
  // Type-based defaults
  // ===========================================================================
  const BY_TYPE: Record<ProjectType, string[]> = {
    'web-app': [
      'legal',
      'seo',
      'errors',
      'hygiene',
      'signatures',
      'quality',
      'secrets',
    ],
    'cli-tool': ['hygiene', 'signatures', 'quality', 'secrets'],
    library: ['hygiene', 'signatures', 'quality', 'secrets'],
    'mobile-app': ['legal', 'errors', 'hygiene', 'signatures', 'quality', 'secrets'],
    'browser-extension': [
      'legal',
      'errors',
      'hygiene',
      'signatures',
      'quality',
      'secrets',
    ],
    'api-service': ['hygiene', 'signatures', 'quality', 'secrets'],
    docs: ['seo', 'quality', 'secrets'],
    // unknown means we couldn't classify confidently. Don't run legal —
    // that's the one category that assumes real users. Everything else
    // is safe to run on any repo.
    unknown: ['seo', 'errors', 'hygiene', 'signatures', 'quality', 'secrets'],
  };

  return BY_TYPE[type];
}

/**
 * Human-readable labels shown in the report card.
 */
export const PURPOSE_LABELS: Record<ProjectPurpose, string> = {
  product: 'a product',
  learning: 'a learning project',
  portfolio: 'a portfolio project',
  docs: 'a documentation site',
  boilerplate: 'a starter template',
  experiment: 'an experiment',
  unknown: 'a project',
};