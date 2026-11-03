# MyNutri production-readiness work

## Repository baseline

- Production source branch: `main`.
- No branch named exactly `tally` existed at the time of this audit.
- Feature work is isolated on `feat/mynutri-production-completion-20261103`.
- The populated Neon project is the existing `Nutrition` project whose application tables live in the `tally` schema. The duplicate empty `Nutrition` project is not used.
- Existing Render production service remains attached to `main`; this branch does not replace the live service or modify existing user data.

## Implemented in this tranche

- Added a null-aware nutrition scaling and aggregation module.
- Added authenticated, user-scoped diary day and period queries.
- Replaced the diary v1 placeholder endpoints with actual PostgreSQL reads.
- Added ISO date validation and bounded SQL date-window queries.
- Changed the health endpoint to check live database connectivity and required authentication configuration.

## Still to implement and verify

This branch is an initial production-correctness tranche, not a claim that every MyNutri requirement is complete. Remaining work includes server-side ownership checks for all mutations, secure authentication configuration, complete nutrient-reference coverage, full calendar/analytics/reporting screens, private persistent image storage, photo-analysis review/confirmation verification, account export/deletion, broader integration/e2e coverage, and live Render verification from the feature branch.

## Production environment

Required server-side settings include `DATABASE_URL` and `JWT_SECRET`. Add `GEMINI_API_KEY` to enable Gemini analysis. Do not commit secret values to the repository.
