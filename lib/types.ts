import type { LanguageDetection } from './detect/language';
import type { LanguagePack } from './detect/language-packs';

// -----------------------------------------------------------------------------
// Core types
// -----------------------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * How sure are we this issue is real?
 *
 *  - high:   deterministic (file exists / doesn't exist, regex match that can't be false)
 *  - medium: strong heuristic (prose signal, code smell that's usually real)
 *  - low:    style opinion or stylistic pattern that might be intentional
 *
 * Missing `confidence` on an Issue defaults to `'high'`.
 * Low-confidence issues contribute far less to the score.
 */
export type Confidence = 'high' | 'medium' | 'low';

export type Category =
  | 'legal'
  | 'seo'
  | 'errors'
  | 'hygiene'
  | 'signatures'
  | 'quality'
  | 'analytics'
  | 'security';

// -----------------------------------------------------------------------------
// Code evidence
// -----------------------------------------------------------------------------

/**
 * One line of context inside a match block.
 */
export interface ContextLine {
  line: number;
  text: string;
  isMatch: boolean;
}

/**
 * One match within a file. The exact substring the regex matched is
 * recorded by character offset within the line. The UI highlights
 * `line.slice(matchStart, matchEnd)` so what the user sees IS what the
 * rule matched.
 */
export interface CodeMatch {
  /** 1-indexed line number within the file. */
  line: number;
  /** Full (possibly truncated) line content. */
  text: string;
  /** Char offset where the regex match starts within `text`. */
  matchStart: number;
  /** Char offset where the regex match ends (exclusive). */
  matchEnd: number;
  /** The block of code surrounding this match (5 lines above, 5 below). */
  context: ContextLine[];
}

/**
 * All matches found in a single file. One `CodeMatch` per hit.
 */
export interface FileEvidence {
  /** Path relative to repo root. */
  file: string;
  /** All matches in this file, ordered by line number. */
  matches: CodeMatch[];
  /** True if this file's matches were truncated (more exist but we capped). */
  truncated?: boolean;
}

/**
 * Issue.evidence is an array of `FileEvidence`, one per file the check
 * matched.
 */
export type CodeEvidence = FileEvidence[];

// -----------------------------------------------------------------------------
// Issue
// -----------------------------------------------------------------------------

export interface Issue {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  fix: string;
  docs?: string;
  affectedFiles?: string[];
  /** Defaults to 'high' when omitted. */
  confidence?: Confidence;
  /**
   * Per-file matches that triggered this issue. Present only when the
   * check could locate specific lines.
   */
  evidence?: CodeEvidence;
}

// -----------------------------------------------------------------------------
// RepoContext
// -----------------------------------------------------------------------------

export interface RepoContext {
  owner: string;
  repo: string;
  branch: string;
  files: string[];
  fileSet: Set<string>;
  getFile: (path: string) => Promise<string | null>;
  getFileByPattern: (re: RegExp) => string | null;
  language: LanguageDetection;
  lang: LanguagePack;
  projectPurpose?: string;
  projectType?: string;
}

// -----------------------------------------------------------------------------
// Scan result
// -----------------------------------------------------------------------------

export interface ProjectTypeInfo {
  type: string;
  confidence: number;
  signals: string[];
}

export interface ProjectPurposeInfo {
  purpose: string;
  confidence: number;
  signals: string[];
}

export interface ScanResult {
  repo: string;
  score: number;
  grade: string;
  issues: Issue[];
  passed: string[];
  fileCount: number;
  scannedAt: string;
  projectType?: ProjectTypeInfo;
  projectPurpose?: ProjectPurposeInfo;
  skippedChecks?: string[];
}