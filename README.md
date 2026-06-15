# eCRM

eCRM is a single-company CRM for a small sales organization. The foundation slice provides the Next.js App Router application baseline, local Postgres database, Prisma schema and migration, internal email/password authentication, Admin and Sales roles, seeded local users, a protected dashboard shell, and verification gates for the CRM modules that follow.

## Local Development

1. Install dependencies.

   ```powershell
   npm install
   ```

2. Create a local environment file.

   ```powershell
   Copy-Item -LiteralPath .env.example -Destination .env -Force
   ```

   Use the root `.env` file as the canonical local environment file. Prisma CLI commands load it automatically, and the seed script uses the same `DATABASE_URL` and seed credentials. You may also export the same variables in your shell before running Prisma or seed commands. Use `.env.local` only for optional Next.js-only local overrides.

3. Start the preferred local database with Docker Compose.

   ```powershell
   docker compose up -d db
   ```

   If Docker is not available, use a local PostgreSQL instance instead. The app expects `DATABASE_URL` to point to PostgreSQL on port `54329`, matching `.env.example`:

   ```dotenv
   DATABASE_URL="postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public"
   ```

   Migrations and seeds run the same way for either database path.

4. Apply the existing migration and seed local users.

   ```powershell
   npx prisma migrate deploy
   npm run prisma:seed
   ```

   Use `npm run prisma:migrate -- --name <migration_name>` later when developing a schema change that needs a new migration.

5. Start the development server.

   ```powershell
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Seeded Local Users

- Admin: `admin@example.com` / `Admin@12345`
- Sales: `sales@example.com` / `Sales@12345`

## Gates

Run the local quality gate and browser smoke tests before every completion claim.

```powershell
npm run gate
npm run test:e2e
```

`next-env.d.ts` is intentionally ignored. Next 16 regenerates it differently between development and build flows, and the committed TypeScript config includes the generated `.next/types/**/*.ts` and `.next/dev/types/**/*.ts` route types.

## Project Documents

- Product design spec: [docs/superpowers/specs/2026-06-15-ecrm-design.md](docs/superpowers/specs/2026-06-15-ecrm-design.md)
- Foundation plan: [docs/superpowers/plans/2026-06-15-ecrm-foundation-plan.md](docs/superpowers/plans/2026-06-15-ecrm-foundation-plan.md)
