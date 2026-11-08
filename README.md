# FinerGithub

A mobile-first GitHub client that works like **github.com on the web**, packaged as an installable PWA (Progressive Web App).

The official GitHub mobile app hides much of what the website can do, and finding things takes too many taps. FinerGithub keeps the web's layout and power features, with controls sized for phones.

## Why it feels like the web

- **Same URLs as github.com.** Every page uses github.com's path, so `github.com/owner/repo/pull/12/files` becomes `<your-host>/owner/repo/pull/12/files`. Links in issues, READMEs and comments open inside the app, and an **Open on github.com** button is always in the top bar.
- **Share links into it.** Once installed, FinerGithub appears in your phone's share sheet. Share a GitHub link to it and it opens the right page.
- **Same search syntax.** Issue and PR lists use the web's filter bar (`is:open author:@me label:bug`), with one-tap chips for common filters.

## Features

| Area | What you get |
| --- | --- |
| **Code** | File tree with breadcrumbs and the last commit for each folder, rendered READMEs, **Go to file** fuzzy finder (the web's `t` shortcut), branch and tag switcher, syntax-highlighted files, line links (`#L10-L20`, tap two lines to select a range), wrap toggle, Raw and copy buttons, file history |
| **Pull requests** | Conversation with reviews and inline threads, checks summary, merge box (squash/merge/rebase, update branch), **Files changed** with line numbers, **comment on any line by tapping its number**, "Viewed" checkboxes with a progress bar, jump-to-file list, submit reviews (comment, approve, request changes) |
| **Issues** | Web-style filtered lists, labels, assignees and milestones, comments with Write/Preview (rendered by GitHub), close/reopen, new issue |
| **Actions** | Runs filtered by workflow, status and branch; jobs and steps; re-run all, re-run failed, cancel; **job logs** with collapsible groups, search, and a jump to the first error |
| **Commits** | History by day for a branch or a path; commit diffs |
| **Releases** | Release notes, assets and source downloads |
| **Home** | Jump box (`owner/repo`, `owner/repo#12` or a pasted link), counts for your PRs, review requests, assigned issues and mentions, recently viewed repositories, your repositories |
| **Inbox** | Notifications grouped by repository, with Unread, Participating and All filters, mark as read, and taps that open the right PR, issue or run |
| **Search** | Repositories, issues & PRs, code, users |
| **General** | Light, dark and system themes; offline app shell; safe-area aware layout for notched phones; works signed out for public repositories |

## Getting started

Requires Node.js 20.12 or newer.

```bash
npm install
cp .env.example .env   # then fill in the OAuth values below
npm run dev            # http://localhost:5173
```

### Sign in with GitHub (OAuth)

1. Create an OAuth App at **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Set **Authorization callback URL** to `<your origin>/oauth/callback`, e.g. `http://localhost:5173/oauth/callback`.
3. Put the Client ID and a generated Client secret in `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

The client secret stays on the server. The browser receives the token once and keeps it in `localStorage` on that device. The app requests the `repo read:org notifications workflow user` scopes. To change them, edit `OAUTH_SCOPES` in `server/api.mjs`.

As a fallback, the sign-in page also accepts a personal access token.

### Production

```bash
npm run build
PORT=8787 npm start    # serves dist/ and the API on one port
```

The server has no dependencies beyond Node itself, so it runs on any Node host (Fly.io, Render, Railway, a VPS…). Serve it over HTTPS so phones can install the PWA, and register the production callback URL in your OAuth App.

## How it works

- **Frontend:** React, React Router and TanStack Query (caching), built with Vite. Requests go straight from the browser to `api.github.com`. Bodies and READMEs use GitHub's own rendered, sanitized HTML (`application/vnd.github.html+json`), so Markdown matches the web exactly.
- **Server (`server/`):** about 150 lines, with two jobs the browser can't do itself:
  - `POST /api/oauth/token` exchanges the OAuth code for a token (this step needs the client secret).
  - `GET /api/logs/:owner/:repo/:jobId` downloads Actions job logs, whose storage URLs lack CORS headers.

  Vite mounts the same handler during development, so `npm run dev` is all you need.

```
server/        OAuth + log proxy (api.mjs), production static server (index.mjs)
src/lib/       GitHub client, auth, URL mapping, diff parsing, highlighting, preferences
src/components Layout, diff viewer, composer, branch picker, file finder, shared UI
src/pages/     Home, Search, Inbox, Settings, profiles, and repo/* (code, issues, PRs, actions, commits, releases)
public/        PWA manifest, service worker, icons (regenerate with scripts/gen-icons.mjs)
```

## Roadmap ideas

- Pending (batched) PR reviews and multi-line comments
- Suggested changes in review comments
- Discussions, Projects and repository settings (GraphQL)
- Web push for notifications
