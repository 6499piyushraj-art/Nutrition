# MyNutri isolated staging setup and smoke test

## Safety boundary

- Use a **new, empty Neon project** for staging. Do not create a branch from the production `Nutrition` project: a Neon branch inherits its parent's data.
- Do not point staging at the production `DATABASE_URL`.
- Create a separate Render web service for this feature branch. Do not retarget the production `mynutri-ai` service, which remains on `main`.
- Keep Gemini, USDA and database credentials in Render environment settings only. Never add them to Git.

## 1. Provision a clean staging database

1. In Neon, create a new project named `mynutri-staging` with an empty default branch.
2. Use a separate database role/credential for the staging application. Copy the connection URL into a temporary shell variable named `STAGING_DATABASE_URL`.
3. From the repository root, preview the proposed schema changes:

   ```sh
   DATABASE_URL="$STAGING_DATABASE_URL" npx drizzle-kit push --config=drizzle.config.ts --explain --verbose
   ```

4. Inspect the plan. It should create the app's `tally` schema and its tables in the new empty project. Stop if the URL points to production or if the plan includes unrelated schemas/tables.
5. Apply the schema only to this new staging project:

   ```sh
   DATABASE_URL="$STAGING_DATABASE_URL" npx drizzle-kit push --config=drizzle.config.ts
   ```

6. Run the app's startup schema/privilege verification:

   ```sh
   DATABASE_URL="$STAGING_DATABASE_URL" npm run db:migrate
   ```

The startup verifier expects these 15 PostgreSQL tables inside `tally`: `users`, `health_profiles`, `nutrient_targets`, `foods`, `food_tags`, `foods_food_tags`, `food_servings`, `diary_entries`, `food_entries`, `exercises`, `measurements`, `meals`, `meal_items`, `meals_food_tags` and `journal_entries`.

The existing `drizzle/` SQL files are SQLite migrations. They are not the PostgreSQL staging migration. `drizzle-kit push` is documented here for a **new empty staging project only**. Production already has the expected schema; do not run schema push against production.

## 2. Create a separate Render staging service

Create a new Node web service using the GitHub repository and these settings:

- Branch: `feat/mynutri-production-completion-20261103`
- Build command: `npm install`
- Start command: `npm start`
- Health-check path: `/api/health`
- Region: choose one close to the staging Neon project
- Auto-deploy: enable for this feature branch only

Set these environment variables in the new Render service:

- `DATABASE_URL`: the new staging Neon connection string
- `JWT_SECRET`: a unique randomly generated staging secret
- `APP_URL`: the new staging Render URL
- `GEMINI_API_KEY`: optional; add only a valid key you are authorised to use
- `GEMINI_MODEL`: optional; otherwise use the repository default
- `USDA_API_KEY`: optional; the application falls back to USDA's demo key

Do not copy production sessions, personal data, JWT secrets or the production database URL into staging.

## 3. Authenticated staging smoke tests

Use a new test account and non-sensitive sample foods. Record pass/fail for every test:

1. Register, sign in, sign out and sign in again.
2. Create a manual food with a known serving size and a few known nutrients.
3. Search for an analytical USDA food and confirm the 100 g basis is shown when FoodData Central has no household serving.
4. Add an existing saved food to a diary date, change its serving multiplier, refresh and confirm the entry persisted exactly once.
5. If a live Gemini key is configured, run text and photo analysis; verify that results are reviewable and are not saved until the user confirms.
6. Update and delete a diary food entry; confirm totals recalculate.
7. Create a journal entry, refresh, edit it and delete it.
8. Save a height measurement and verify that the latest-measurements endpoint returns it.
9. Create and edit a saved meal using only foods owned by the test account.
10. Export food history as CSV and JSON; open the printable report and use the browser's Print dialog to save it as PDF.
11. Export measurements and a full JSON account backup; confirm password hashes and authentication tokens are absent.
12. Create a second test account and verify it cannot read or edit the first account's foods, diary, tags, meals, journal or profile.
13. Restart/redeploy the staging service and confirm records persist in the staging Neon database.
14. Review Render logs and confirm startup reports all 15 required tables verified.

## 4. Release gate

Only after the checklist passes:

- Record the staging URL, test date and results in PR #10.
- Confirm the latest GitHub Actions run passes tests, production build and TypeScript checks.
- Review the complete PR diff and any database schema changes.
- Obtain explicit release approval before merging into `main`.
- Let the existing production Render service deploy from `main`, then verify `/api/health`, sign-in, persistence and the deployed commit.

A green GitHub Actions run is build validation, not a substitute for authenticated staging persistence and ownership tests.