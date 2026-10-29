Here is the complete, fixed `README.md`. 

I fixed the capitalization typos (`Github` → `github`, `GitCheck` → `gitCheck` in commands, `GitHUB_TOKEN` → `GITHUB_TOKEN`, `.Gitignore` → `.gitignore`), updated it to reflect your current **Next.js 16 + pnpm** stack and new features (View Code, Context Awareness, Security checks), and switched the license to **MIT**.

Copy the text below and paste it directly into your `README.md` file.

```markdown
# gitCheck

**Your AI wrote the code. We make it ready.**

Paste a GitHub repo URL. Get an honest report on what makes your app look like a prototype instead of a finished product.

[**Try it live →**](https://gitcheck-seven.vercel.app)

---

## Demo

https://github.com/himanshu-here-code/gitcheck/blob/main/public/gitcheck-demo.mp4

*(If the video doesn't play above, [watch it here](https://gitcheck-seven.vercel.app) or download it from the repo.)*

---

## What it does

gitCheck scans public GitHub repositories and flags the small things that quietly tell people your app isn't finished yet. No AI. No database. No storage. Just context-aware static analysis and an honest report.

It looks for:

| Category | What it checks |
|---|---|
| **Security** | Public env vars with secrets, committed `.env` files, hardcoded keys |
| **Legal & Trust** | Privacy policy, terms of service, cookie consent, license, contact page |
| **SEO & Meta** | Page title, description, Open Graph image, favicon, robots.txt, sitemap |
| **Errors & Edge States** | 404 page, error boundary, loading states, empty states |
| **Code Hygiene** | `.env.example`, `.gitignore`, committed secrets, README, TODO comments |
| **Vibecoded Signatures** | Placeholder copy, default fonts, purple gradients, hardcoded localhost URLs |

**No false alarms.** gitCheck detects the project type (e.g., Next.js web app vs. Python library vs. learning project) *before* running checks. A tutorial doesn't get flagged for a missing privacy policy, and a library doesn't get flagged for a missing 404 page.

Each issue comes with a plain-English explanation, a **View code** button (showing the exact lines that triggered the flag), and a **Copy fix prompt** button — paste it into Cursor, Claude, or ChatGPT.

There's also a single **Copy full report for AI** button that packages every issue into a structured, priority-ordered prompt, ready for your AI of choice.

---

## Why

I built gitCheck because I kept seeing the same thing: people shipping AI-built apps that technically work but look unfinished. Missing privacy pages. Placeholder text still visible. Default Vite titles. No error boundary. Leaked Stripe keys.

None of these things are hard to fix. But nobody tells you they matter until someone bounces off your app or, worse, exploits it.

gitCheck is the tool I wish existed when I was shipping my first AI-built project.

---

## How it works

```
User pastes repo URL
        ↓
POST /api/scan
        ↓
1. Parse owner/repo from the URL
2. Fetch the file tree via GitHub's API
3. Detect project type and purpose (Context Awareness)
4. Download a subset of source files
5. Run static checks (regex + AST-lite + file presence)
6. Score and categorize issues
        ↓
Render the report — score, verdict, grouped issues, code evidence
```

Nothing is persisted. The repo is fetched, analyzed, and forgotten.

---

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **Tailwind CSS v4**
- **GitHub REST API** (public, no scopes needed)
- **Vercel** for hosting + analytics
- **pnpm** for package management

Zero external services. Zero database. Zero AI API costs.

---

## Local setup

```bash
# Clone
git clone https://github.com/himanshu-here-code/gitcheck.git
cd gitcheck

# Install
pnpm install

# Configure
cp .env.example .env.local
# Then open .env.local and add your GitHub token

# Run
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Getting a GitHub token

You need a token to raise the API rate limit from 60 requests/hour (unauthenticated) to 5,000 requests/hour. It's free.

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Name: `gitcheck-local`
4. Expiration: 90 days (or whatever you prefer)
5. **Leave every scope unchecked** — public repos only need an empty token
6. Click **Generate token** and copy the `ghp_...` value
7. Paste it into `.env.local` as `GITHUB_TOKEN=ghp_...`

Never commit `.env.local`. It's already in `.gitignore`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | Classic GitHub PAT with zero scopes. Used for public repo access only. |

---

## Project structure

```
gitcheck/
├── app/
│   ├── api/scan/route.ts       # The scanner endpoint
│   ├── privacy/page.tsx        # Privacy policy
│   ├── terms/page.tsx          # Terms of service
│   ├── not-found.tsx           # Custom 404
│   ├── error.tsx               # Error boundary
│   ├── layout.tsx              # Root layout + fonts
│   ├── page.tsx                # The one-page app
│   └── globals.css             # Design tokens + utilities
├── components/
│   ├── CategorySection.tsx     # Collapsible report section
│   ├── CodePreview.tsx         # View code evidence blocks
│   ├── Footer.tsx
│   ├── Header.tsx
│   ├── Hero.tsx
│   ├── Icons.tsx               # All inline SVG icons
│   ├── IssueCard.tsx           # Individual issue with copy button
│   ├── LoadingScan.tsx         # The rotating scan loader
│   ├── ProfileCard.tsx         # Report header with avatar + copy-all
│   ├── ScanInput.tsx           # The URL input + scan button
│   ├── ScoreRing.tsx           # Animated score ring
│   └── StatGrid.tsx            # Issues / Passed / Files counters
├── lib/
│   ├── github.ts               # GitHub API helpers
│   ├── cache.ts                # Scan caching & URL encoding
│   ├── types.ts                # Shared TypeScript types
│   └── checks/
│       ├── index.ts            # Runs all checks, computes score
│       ├── legal.ts            # Privacy, terms, cookies, license
│       ├── seo.ts              # Meta tags, favicon, OG image
│       ├── errors.ts           # 404, error boundary, loading
│       ├── hygiene.ts          # .env, .gitignore, README, secrets
│       ├── quality.ts          # Alt text, large files, TODOs
│       ├── secrets.ts          # Public env leaks
│       └── signatures.ts       # Vibecoded fingerprint patterns
├── public/
│   ├── icon.png                # Header icon
│   └── gitcheck-demo.mp4       # Demo video
├── LICENSE
├── README.md
└── SECURITY.md
```

---

## Adding a new check

Each check lives in `lib/checks/`. Every check exports a function that returns `{ issues: Issue[], passed: string[] }`.

1. Create a new file: `lib/checks/your-check.ts`
2. Export an async function that takes `RepoContext` and returns the shape above
3. Import it in `lib/checks/index.ts` and add it to the `RUNNERS` map
4. Severity weights live at the top of `index.ts` — tune as needed

The `RepoContext` object gives you:

- `files` — every file path in the repo
- `fileSet` — a Set for fast lookups
- `getFile(path)` — fetch a file's content (cached)
- `getFileByPattern(regex)` — find the first matching file

Nothing else. Keep checks stateless.

---

## Roadmap

- [x] Core scanner + scoring
- [x] Context-awareness (detects project type & purpose)
- [x] View code evidence (shows exact lines)
- [x] Copy fix prompt per issue
- [x] Copy full report for AI
- [x] Privacy policy, terms, footer, 404, error boundary
- [x] Vercel Analytics + Speed Insights
- [ ] Shareable public scan URLs (`/scan/owner/repo`)
- [ ] Private repo support (with OAuth)
- [ ] CLI: `npx gitcheck owner/repo`
- [ ] GitHub Action: run on every PR

---

## Deploying

The fastest path is Vercel:

```bash
pnpm install -g vercel
vercel
```

Then in the Vercel dashboard:

1. Go to **Settings → Environment Variables**
2. Add `GITHUB_TOKEN` for Production, Preview, and Development
3. Redeploy

---

## Contributing

Issues and PRs welcome. A few guidelines:

- **Small PRs.** One check per PR, one bug fix per PR. Makes review sane.
- **Test your check.** Run it against 5-10 real repos before submitting.
- **Avoid false positives.** A check that flags something that isn't a problem is worse than no check at all. Add an exception rather than a shaky match.
- **Match the voice.** The UI copy is direct and human. New issues should sound like a friend telling you what's wrong, not a linter barking at you.

---

## License

[MIT](LICENSE) — you're free to fork, self-host, and modify gitCheck.
```