import { betterAuth } from "better-auth";
import { db, query } from "@/lib/db";

const isProduction = process.env.NODE_ENV === "production";
const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL || (!isProduction ? "http://localhost:3000" : undefined);

if (isProduction && !secret) throw new Error("BETTER_AUTH_SECRET must be configured in production.");
if (isProduction && !baseURL) throw new Error("BETTER_AUTH_URL must be configured in production.");

export const auth = betterAuth({
  database: db,
  baseURL,
  secret: secret || "artistpilot-local-development-only-secret",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  databaseHooks: {
    user: {
      create: {
        async after(user) {
          await query(
            `INSERT INTO profiles (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
            [user.id],
          );
        },
      },
    },
  },
});
