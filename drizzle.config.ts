import 'dotenv/config';
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL || process.env.CONNECTION_STRING;

if (!connectionString) {
  throw new Error("DATABASE_URL or CONNECTION_STRING, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
