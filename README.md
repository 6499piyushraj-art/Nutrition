# MyNutri

**Understand your food. Keep nutrition data transparent.**

MyNutri is a mobile-first nutrition tracker built with Next.js, TypeScript, PostgreSQL and Drizzle ORM. The production deployment is configured to use Neon PostgreSQL and Render.

## Current application areas

- Daily dashboard, food diary and date-based history.
- Searchable personal food library and saved meals.
- Text-based and photo-based Gemini food estimates with an explicit review step before saving.
- Nutrient summaries with incomplete-data handling.
- Age-aware ICMR-NIN adolescent reference values where a valid age band and sex category are available.
- Historical nutrient summaries and CSV/JSON food-history export.
- Private profile and measurement history.

Features are being completed incrementally. See [docs/PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md) and the active pull request for verified status. Do not treat AI food-photo estimates or population reference values as medical advice.

## Production architecture

- **Frontend/API:** Next.js App Router, React and TypeScript.
- **Database:** Neon PostgreSQL via Drizzle ORM.
- **Hosting:** Render Node web service.
- **AI:** Server-side Gemini integration. The browser never receives the Gemini API key.
- **Authentication:** Password hashing and signed HTTP-only session cookies.

Production data must remain in Neon; do not store user records on Render's ephemeral filesystem.

## Local development

Requirements: Node.js 20+, npm and a PostgreSQL connection.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `DATABASE_URL` and a unique high-entropy `JWT_SECRET` in `.env.local`. Run the repository's documented database migration command before using a fresh database.

## Environment variables

- `DATABASE_URL` — Neon PostgreSQL connection string.
- `JWT_SECRET` — private signing secret; do not use the development placeholder in production.
- `GEMINI_API_KEY` — optional server-side AI key for food analysis.
- `GEMINI_MODEL` — optional server-side Gemini model name.
- `APP_URL` — canonical public application URL when required by integrations.

Never commit `.env` or secret values.

## Deployment

The existing Render service is `mynutri-ai`. The production service remains on `main` until feature-branch tests and production checks pass. The active implementation branch is `feat/mynutri-production-completion-20261103`.

## Data references

Adolescent nutrient references use ICMR-NIN's RDA/EAR 2020 population tables, surfaced via an FSSAI summary. The reference category, source year and source link are shown in the app where applicable. Food-composition values remain attached to their source and quality status; missing values are not counted as zero.
