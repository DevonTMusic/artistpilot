import { Pool } from "pg";

const email = "demo@demo.com";
const password = "password123!";
const baseUrl = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "");
if (!baseUrl) throw new Error("Set BETTER_AUTH_URL to the deployed app URL before seeding the demo account.");
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the Neon connection string before seeding the demo account.");

async function authRequest(endpoint, body) {
  const response = await fetch(`${baseUrl}/api/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: new URL(baseUrl).origin },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  return { response, result };
}

const signup = await authRequest("sign-up/email", {
  name: "ArtistPilot Demo",
  email,
  password,
});

if (!signup.response.ok) {
  const signin = await authRequest("sign-in/email", { email, password });
  if (!signin.response.ok) {
    throw new Error(
      `Could not create or sign in to ${email}. Sign-up: ${JSON.stringify(signup.result)}; sign-in: ${JSON.stringify(signin.result)}`,
    );
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const result = await pool.query(
    `update profiles p set is_paid = true
     from "user" u where p.id = u.id and u.email = $1`,
    [email],
  );
  if (result.rowCount !== 1) {
    throw new Error(`Expected one Neon profile for ${email}; found ${result.rowCount}. Confirm the Neon schema is applied.`);
  }
  console.log("Demo account ready with paid access:", email);
} finally {
  await pool.end();
}
