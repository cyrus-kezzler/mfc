import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit isn't routed through Next, so it doesn't auto-load .env.local.
// Load it explicitly, falling back to .env for CI/server environments.
config({ path: ".env.local" });
config(); // .env as fallback (does nothing if .env.local already populated)

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
