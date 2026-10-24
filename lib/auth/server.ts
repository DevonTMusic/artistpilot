import { betterAuth } from "better-auth";
import { db, query } from "@/lib/db";

const isProduction = process.env.NODE_ENV === "production";
const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = isProduction
  ? {
    allowedHosts: ["artistpilot.com", "www.artistpilot.com", "artistpilot-*.vercel.app"],
    protocol: "https" as const,
    fallback: "https://artistpilot.com",
  }
  : process.env.BETTER_AUTH_URL || "http://localhost:3000";

if (isProduction && !secret) throw new Error("BETTER_AUTH_SECRET must be configured in production.");

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
