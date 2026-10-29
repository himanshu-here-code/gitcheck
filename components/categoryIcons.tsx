/**
 * Category icons for the scan report.
 *
 * All glyphs share the same visual language as the rest of the site:
 *   - 24×24 viewBox, 2.2 stroke width
 *   - stroke-linecap round, stroke-linejoin round
 *   - `currentColor` so the parent controls color
 *
 * Each icon sits inside a 44×44 colored square (see CategorySection),
 * and the stroke stays dark on every color — matching the brutalist
 * button style used throughout the app.
 */

interface IconProps {
  size?: number;
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Legal — scales of justice
export const LegalIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 3v18" />
    <path d="M5 21h14" />
    <path d="M7 7h10" />
    <path d="M7 7l-4 8a4 4 0 008 0z" />
    <path d="M17 7l-4 8a4 4 0 008 0z" />
  </svg>
);

// SEO — magnifying glass
export const SeoIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.5-4.5" />
  </svg>
);

// Errors — warning triangle
export const ErrorsIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 3l10 17H2z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

// Hygiene — broom / sparkle check
export const HygieneIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M14 3l7 7-3 3-7-7z" />
    <path d="M11 6l-8 8v6h6l8-8" />
    <path d="M15 15l-3 3" />
  </svg>
);

// Signatures — sparkle (matches hero sparkle language)
export const SignaturesIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 3v6" />
    <path d="M12 15v6" />
    <path d="M3 12h6" />
    <path d="M15 12h6" />
    <path d="M6.5 6.5l3 3" />
    <path d="M14.5 14.5l3 3" />
    <path d="M17.5 6.5l-3 3" />
    <path d="M9.5 14.5l-3 3" />
  </svg>
);

// Quality — target
export const QualityIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

// Analytics — bar chart
export const AnalyticsIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 20V10" />
    <path d="M10 20V4" />
    <path d="M16 20v-6" />
    <path d="M22 20H2" />
  </svg>
);

// Security — shield with check
export const SecurityIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" />
    <path d="M8.5 12l2.5 2.5L16 9" />
  </svg>
);