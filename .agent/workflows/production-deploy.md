---
description: Steps to deploy the Phoenix Tax application with Ollama and Convex production settings.
---

1. Ensure all environment variables are set in the Convex dashboard:
   - `OLLAMA_API_URL`
   - `OLLAMA_MODEL`
   - `CLERK_SECRET_KEY`
2. Run typechecks and linting:
   // turbo
   `pnpm tsc && pnpm lint`
3. Push to Convex production:
   // turbo
   `npx convex deploy`
4. Deploy the frontend:
   `pnpm build`
5. Run E2E verification tests:
   `pnpm test:e2e`
