# MyNutri production-readiness report

**Last reviewed:** 2026-11-03  
**Repository:** `6499piyushraj-art/Nutrition`  
**Working branch:** `feat/mynutri-production-completion-20261103`  
**Pull request:** [#10 — MyNutri production correctness and product completion](https://github.com/6499piyushraj-art/Nutrition/pull/10)

## Baseline and change safety

- The repository has no branch named exactly `tally`. Existing tally-derived branches were inspected.
- Work is isolated from `main`; the production branch has not been overwritten.
- The populated Neon project is the existing `Nutrition` project with application tables under the `tally` schema. A separate duplicate project has only platform-auth tables and is not used.
- The existing Render service `mynutri-ai` remains attached to `main`. This branch has not been promoted or deployed to the production service.
- Existing production data and branches have not been deleted.

## Implemented in this branch

### Data integrity and API correctness

- Shared portion-scaling and aggregation helpers preserve missing nutrients as unknown.
- Meal totals remain incomplete when one or more logged foods lack a nutrient value.
- Authenticated, user-scoped daily diary and 7/30/90-day summary endpoints query PostgreSQL.
- Date inputs are validated and historical SQL queries have bounded date windows.
- The health endpoint checks database connectivity and required authentication configuration.
- Food-entry add, edit and delete operations verify ownership. Deleted foods cannot be selected for new diary entries.
- Custom foods, food tags, saved meals, meal items and journal entries have owner-scoped CRUD paths and validation.

### Authentication, privacy and age safeguards

- JWT signing fails closed when `JWT_SECRET` is absent or remains the development placeholder.
- Session cookies are HTTP-only; production cookies use the Secure attribute.
- Registration validates fields and has an IP-based attempt limit.
- Account deletion requires the current password and an explicit `DELETE` confirmation.
- Missing, malformed or under-18 birth dates are treated conservatively. Weight-goal and weight-history tools are hidden or blocked unless an adult age is verified.
- Calorie targets and calorie displays are omitted for under-18 or age-unknown profiles.
- Height history is optional and is not used to predict future height or score appearance.

### Food logging and AI

- Food logging can search the user's own saved foods and the existing USDA FoodData Central service without an AI request.
- Selected foods can be reviewed with a portion count before saving.
- USDA identifiers and source metadata are retained when a search result is logged.
- Text and photo analysis use a server-side Gemini workflow; results require user review and confirmation before saving.
- The Gemini integration has been migrated to Google's `@google/genai` SDK. CI for the SDK migration is still being checked; a working Gemini API credential has not been available for a live provider request.

### Application screens and exports

- MyNutri branding, icon and PWA manifest are updated.
- Primary navigation routes to Today, Diary, Scan, Analysis and More.
- Calendar/history, nutrient analysis, growth/measurements and reports/export destinations are implemented.
- Food-history and measurement CSV/JSON exports are user-scoped and date-filtered.
- Full-account JSON backup includes all dates and user-owned app records while excluding password hashes and authentication tokens.

## Verification status

- The most recent fully verified pre-SDK commit passed the GitHub Actions unit-test, production-build and TypeScript type-check steps.
- CI runs are configured to execute unit tests, `next build` and TypeScript checking.
- The current SDK migration needs its own green run before it can be treated as verified.
- No authenticated production workflow test (registration/login, add/edit/delete food, refresh, logout and second-login persistence) has been completed against the live Render service from this branch.
- No end-to-end Playwright suite has been added yet.
- The live Render service's existing logs showed a successful Neon connection and startup on `main`; this is not evidence that the feature branch has been deployed.

## Remaining work before production promotion

1. **Gemini runtime verification:** configure a real server-side `GEMINI_API_KEY` and compatible `GEMINI_MODEL`, then exercise text and image requests, timeout/quota errors, failover and confirmation workflow.
2. **Persistent private image storage:** photographs are currently sent to the analysis service and are not retained in persistent object storage. Configure and verify private storage before claiming photo persistence.
3. **Nutrition dataset breadth:** the Indian-food fallback is limited and must not be represented as a comprehensive IFCT/INDB catalogue. Obtain and confirm redistribution permissions before importing third-party Indian food composition data. Continue to show source and data-quality status.
4. **Nutrient coverage:** the visible targets and tracked nutrients do not yet cover every extended micronutrient requested in the build specification.
5. **Portion and recipe completeness:** raw/cooked variants, household unit conversions and full ingredient-based recipe nutrition need further implementation and verification.
6. **Analytics and reports:** contributor breakdowns, richer charts, comparisons and true generated PDF reports remain incomplete; browser print is not a server-generated PDF.
7. **Account lifecycle:** password reset/email flow and comprehensive account-deletion verification require an email provider and integration tests.
8. **Automated tests:** add database integration, authorization-isolation and end-to-end persistence tests using an isolated test database.
9. **Production rollout:** validate the branch against a safe staging database/service, configure Render health checks and environment variables, deploy and smoke-test it, and only then consider merging to `main`.

## Production configuration

Required server-side variables:

- `DATABASE_URL` — populated Neon PostgreSQL connection string.
- `JWT_SECRET` — long, unique signing secret.

Optional provider/configuration values:

- `GEMINI_API_KEY` — required to exercise AI food analysis.
- `GEMINI_MODEL` — compatible Gemini model identifier.
- `APP_URL` — canonical public application URL where needed.

No credential values belong in Git. Persistent object-storage variables are not yet part of the working implementation because a storage provider has not been configured or verified.

## Deployment decision

**Not ready for production promotion yet.** The feature branch is a substantial functional and security improvement, but the outstanding storage, nutrition-dataset, provider-runtime, integration-test and staging-deployment checks mean that a green build alone is not sufficient. The existing Render production service remains on `main`.
