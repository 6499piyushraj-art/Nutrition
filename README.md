# MyNutri AI

A mobile-friendly nutrition tracker that sends a food description or meal photo to Gemini **from the server**, returns a structured nutrition estimate, and fills an editable review form. Nothing is added to the log until the user confirms Save.

## Features

- Natural-language food names and descriptions in Hindi, Hinglish, English, and local dish names; portion amounts are optional, and long descriptions are no longer truncated to 2,000 characters.
- Google Search grounding with structured nutrition output and source links when Gemini returns citations; packaged foods can be searched by brand/product name.
- Server-side Gemini integration using `@google/genai` Interactions API with Google Search grounding and structured JSON results. Requests opt out of stored interaction history (`store: false`); Google API terms still govern provider processing.
- Editable energy, macros, and selected micronutrients before saving.
- Daily totals, target progress, food history, nutrient view, and JSON/CSV export.
- Neon PostgreSQL persistence for daily targets and meal history, with a local browser cache for quick loading. Meal photos are processed in memory for analysis and are not saved to cloud storage.
- Password-gated hosted app with signed, HttpOnly sessions and rate-limited login/analysis routes.
- Render Blueprint included.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add a real Gemini API key to `GEMINI_API_KEY`, the Neon pooled PostgreSQL connection string to `DATABASE_URL`, a strong `APP_PASSWORD`, and a random secret of at least 32 characters for `SESSION_SECRET`.
5. Run `npm start` and open `http://localhost:3000`.

For local use without a password, leave `APP_PASSWORD` blank only when `NODE_ENV` is not `production`. Analysis still requires `GEMINI_API_KEY`.

## Deploy to Render

1. Connect this repository to Render, then create a Web Service from the Blueprint in `render.yaml` (or configure a Node Web Service directly).
2. Set the following environment variables in Render's Environment settings:
   - `GEMINI_API_KEY`: your key from Google AI Studio.
   - `DATABASE_URL`: the Neon connection string for the dedicated `mynutri_app` role. Keep it in Render's private Environment settings only.
   - `APP_PASSWORD`: a long password only you know.
   - `SESSION_SECRET`: a random secret with at least 32 characters (Blueprint generation can create this automatically).
   - `GEMINI_MODEL`: `gemini-3.8-flash` (configurable).
   - `NODE_ENV`: `production`.
3. Save changes and wait for the service to redeploy. The app shows a setup page and disables application/API access until the password and session secret are configured.

**Never put API keys in frontend files, a GitHub commit, or a screenshot.** Enter secrets only in Render's private environment settings. If a key has ever been committed, revoke it and create a new one.

## Data and privacy

Food logs, daily targets, and history are stored in the configured Neon PostgreSQL database and can be loaded across devices after signing in to the same private app. The browser keeps a local cache to help recover from temporary connectivity problems; the cloud database is authoritative. Meal photos are processed in memory, sent to the configured Gemini API for analysis, and are not written to disk or stored in Neon. Google API terms and your account settings govern processing by Google. The hosted interface requires an app password.

## Nutrition accuracy

Nutrition results are AI estimates, not lab measurements or a verified nutrient database. Portion size, recipe, oil, ingredients, and cooking methods can significantly change values. Micronutrients the model cannot reasonably estimate are left blank rather than treated as zero. Check package labels or reliable food-composition references when precision matters. The app is not medical advice; personal nutrition needs, especially for teenagers, should be discussed with a trusted adult and qualified health professional.

## Checks

Run `npm test` for the smoke tests. The `/health` endpoint is intended for Render's health check and does not reveal configuration secrets.
