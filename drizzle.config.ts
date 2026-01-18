import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.NEW_SUPABASE_DATABASE_URL_URI || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
