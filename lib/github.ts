import { RepoContext } from './types';
import { detectLanguages } from './detect/language';
import { LANGUAGE_PACKS } from './detect/language-packs';

const GH = 'https://api.github.com';

function headers(authToken?: string) {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gitcheck',
  };
  // Prefer the user's token if provided; fall back to our env token
  const token = authToken || process.env.GITHUB_TOKEN;
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

/**
 * Parses essentially any GitHub URL format into { owner, repo }.
 * Accepts:
 *  - owner/repo
 *  - https://github.com/owner/repo
 *  - http://github.com/owner/repo.git
 *  - github.com/owner/repo/
 *  - www.github.com/owner/repo
 */
export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  if (!input || typeof input !== 'string') return null;

  // Clean the input: remove whitespace, ".git", trailing slashes
  const cleaned = input.trim().replace(/\.git$/i, '').replace(/\/$/, '');

  // 1. Handle "owner/repo" format directly
  const shortFormat = /^([\w.-]+)\/([\w.-]+)$/;
  const shortMatch = cleaned.match(shortFormat);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  // 2. Handle full URLs (with or without protocol, www, etc.)
  const urlFormat = /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i;
  const urlMatch = cleaned.match(urlFormat);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  return null;
}

function encodeRepoPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function buildRepoContext(
  owner: string,
  repo: string,
  authToken?: string
): Promise<RepoContext> {
  // 1. Repo metadata
  const repoRes = await fetch(`${GH}/repos/${owner}/${repo}`, {
    headers: headers(authToken),
  });
  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(
        authToken
          ? 'Repo not found, or your token doesn\'t have access to it. Check that the token has the "repo" scope for private repos.'
          : 'Repo not found (is it public?)'
      );
    }
    if (repoRes.status === 401) {
      throw new Error('GitHub token is invalid or expired.');
    }
    if (repoRes.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later, or add a token.');
    }
    throw new Error(`GitHub error: ${repoRes.status}`);
  }
  const repoData = await repoRes.json();
  const branch = repoData.default_branch;

  // 2. File tree
  const treeRes = await fetch(
    `${GH}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: headers(authToken) }
  );
  if (!treeRes.ok) throw new Error(`Tree fetch failed: ${treeRes.status}`);
  const treeData = await treeRes.json();

  const files: string[] = (treeData.tree || [])
    .filter((n: any) => n.type === 'blob')
    .map((n: any) => n.path);

  const fileSet = new Set(files);

  // 3. Cached file fetcher
  const cache = new Map<string, string | null>();
  const getFile = async (path: string): Promise<string | null> => {
    if (cache.has(path)) return cache.get(path)!;
    if (!fileSet.has(path)) {
      cache.set(path, null);
      return null;
    }
    try {
      const encodedPath = encodeRepoPath(path);
      const encodedBranch = encodeURIComponent(branch);
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${encodedBranch}/${encodedPath}`,
        authToken ? { headers: { Authorization: `token ${authToken}` } } : undefined
      );
      if (!res.ok) {
        cache.set(path, null);
        return null;
      }
      const text = await res.text();
      // Cap file size to prevent memory blowups on massive minified files
      const val = text.length > 500_000 ? text.slice(0, 500_000) : text;
      cache.set(path, val);
      return val;
    } catch {
      cache.set(path, null);
      return null;
    }
  };

  const getFileByPattern = (re: RegExp): string | null => {
    return files.find((f) => re.test(f)) ?? null;
  };

  // 4. Language detection
  const language = detectLanguages(files);
  const lang = LANGUAGE_PACKS[language.primary];

  return {
    owner,
    repo,
    branch,
    files,
    fileSet,
    getFile,
    getFileByPattern,
    language,
    lang,
  };
}