# MyNutri AI

A mobile-friendly nutrition tracker that sends a food description or meal photo to Gemini **from the server**, returns a structured nutrition estimate, and fills an editable review form. Nothing is added to the log until the user confirms Save.

## Features

- Hindi, English, and Hinglish food descriptions, plus meal-photo analysis.
- Server-side Google Gemini integration using `@google/genai`.
- Editable energy, macros, and selected micronutrients before saving.
- Daily totals, target progress, food history, nutrient view, and JSON/CSV export.
- Local-device storage for profile and food logs. No food log or uploaded photo is stored on the server.
- Password-gated hosted app with signed, HttpOnly sessions and rate-limited login/analysis routes.
- Render Blueprint included.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add a real Gemini API key to `GEMINI_API_KEY`. Choose a strong value for `APP_PASSWORD` and a random secret of at least 32 characters for `SESSION_SECRET`.
5. Run `npm start` and open `http://localhost:3000`.

For local use without a password, leave `APP_PASSWORD` blank only when `NODE_ENV` is not `production`. Analysis still requires `GEMINI_API_KEY`.

## Deploy to Render

1. Connect this repository to Render, then create a Web Service from the Blueprint in `render.yaml` (or configure a Node Web Service directly).
2. Set the following environment variables in Render's Environment settings:
   - `GEMINI_API_KEY`: your key from Google AI Studio.
   - `APP_PASSWORD`: a long password only you know.
   - `SESSION_SECRET`: a random secret with at least 32 characters (Blueprint generation can create this automatically).
   - `GEMINI_MODEL`: `gemini-3.8-flash` (configurable).
   - `NODE_ENV`: `production`.
3. Save changes and wait for the service to redeploy. The app shows a setup page and disables application/API access until the password and session secret are configured.

**Never put API keys in frontend files, a GitHub commit, or a screenshot.** Enter secrets only in Render's private environment settings. If a key has ever been committed, revoke it and create a new one.

## Data and privacy

Food logs, saved profile targets, and history live in this browser's local storage. They are not synced to other devices and can be removed by clearing browser storage. Meal photos are processed in memory, sent to the configured Gemini API for analysis, and not written to disk by this server. Google API terms and your account settings govern processing by Google. The hosted interface requires an app password.

## Nutrition accuracy

Nutrition results are AI estimates, not lab measurements or a verified nutrient database. Portion size, recipe, oil, ingredients, and cooking methods can significantly change values. Micronutrients the model cannot reasonably estimate are left blank rather than treated as zero. Check package labels or reliable food-composition references when precision matters. The app is not medical advice; personal nutrition needs, especially for teenagers, should be discussed with a trusted adult and qualified health professional.

## Checks

Run `npm test` for the smoke tests. The `/health` endpoint is intended for Render's health check and does not reveal configuration secrets.
