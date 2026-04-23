# Weekly Lighthouse Monitoring System

An internal tool that automates weekly Google Lighthouse performance audits across multiple projects. Every week it runs audits against representative URLs, extracts Core Web Vitals and performance scores, generates AI-powered engineering summaries via the Groq API, and saves structured reports to the filesystem.

---

## Overview

- **Audit pipeline** — runs via `npm run audit` locally or triggered by GitHub Actions on a weekly schedule
- **Project management** — built-in Next.js UI at `/projects` for creating and managing monitored projects
- **Reports** — saved as JSON (and optionally Markdown) to the `reports/` directory
- **AI summaries** — each audited URL gets a concise Good / Needs Attention / Recommended Fixes summary from Groq

---

## Prerequisites

- **Node.js 20+**
- **PostgreSQL** — local instance or hosted (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com))
- **Chromium / Chrome** — required by Lighthouse for running audits
- **Groq API key** — free at [console.groq.com](https://console.groq.com)

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/lighthouse_monitoring"
GROQ_API_KEY="gsk_..."
REPORT_OUTPUT_DIR="./reports"
MARKDOWN_OUTPUT_ENABLED="false"
```

### 3. Set up the database

Generate the Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

When prompted for a migration name, enter something like `init`.

### 4. Start the Next.js development server

```bash
npm run dev
```

Open [http://localhost:3000/projects](http://localhost:3000/projects) to manage your monitored projects.

---

## Running the Audit Pipeline Locally

Once you have at least one active project with URLs configured:

```bash
npm run audit
```

This runs the full pipeline:
1. Loads active projects from the database
2. Runs Lighthouse audits for each URL (requires Chrome)
3. Extracts performance metrics and Core Web Vitals
4. Generates AI summaries via Groq
5. Saves a JSON report (and Markdown if enabled) to `REPORT_OUTPUT_DIR`

Reports are saved as `reports/report-YYYY-MM-DD.json`.

### Install Chromium for audits

If Chrome is not already installed on your machine, install it via Puppeteer:

```bash
npx puppeteer browsers install chrome
```

---

## Running Tests

```bash
npm test
```

Run a specific test file:

```bash
npm test -- --testPathPattern=metrics-extractor
```

---

## Project Structure

```
├── .github/workflows/weekly-audit.yml   # GitHub Actions scheduled workflow
├── prisma/schema.prisma                  # Database schema
├── scripts/run-audits.ts                 # Audit pipeline entry point
├── src/
│   ├── app/
│   │   ├── api/projects/                 # Project CRUD API routes
│   │   └── projects/                     # Project management UI pages
│   ├── lib/
│   │   ├── audit/                        # runner, metrics-extractor, ai-summarizer
│   │   ├── report/                       # generator, json-writer, markdown-writer
│   │   ├── validation/                   # URL and field validation
│   │   ├── config.ts                     # Environment variable validation
│   │   ├── logger.ts                     # Structured JSON logger (pino)
│   │   └── prisma.ts                     # Prisma client singleton
│   └── types/index.ts                    # Shared TypeScript types
├── reports/                              # Generated reports (gitignored)
├── .env.example                          # Environment variable documentation
└── README.md
```

---

## GitHub Actions — Weekly Scheduler

The workflow at `.github/workflows/weekly-audit.yml` runs every Monday at 06:00 UTC. It can also be triggered manually from the GitHub Actions UI.

### Required Secrets

Configure these in your repository under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GROQ_API_KEY` | Groq API key for AI summaries |

### How it works

1. Checks out the repository
2. Installs Node.js 20 and dependencies
3. Installs Chromium via Puppeteer
4. Runs `prisma migrate deploy` to apply any pending migrations
5. Runs `npm run audit` — the same command used locally
6. Uploads the generated reports as a GitHub Actions artifact (retained for 90 days)

---

## Adding a Project

1. Open [http://localhost:3000/projects/new](http://localhost:3000/projects/new)
2. Fill in the project title, owner, environment, and up to 5 representative URLs
3. Click **Create Project**

The project will be included in the next audit run. To trigger an immediate audit locally:

```bash
npm run audit
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create a new project |
| `GET` | `/api/projects/:id` | Get a single project |
| `PUT` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project |
| `PATCH` | `/api/projects/:id/status` | Enable or disable monitoring |

---

## Deployment

Deployment target is deferred — the application is deployment-agnostic. Suitable options include:

- **Vercel** — for the Next.js app (API routes + UI)
- **Railway / Render** — for a full-stack deployment
- **GitHub Actions only** — if you only need the audit pipeline without a hosted UI

When deploying, set the same environment variables from `.env.example` in your platform's secret/environment configuration.
