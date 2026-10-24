# Supabase Studio file storage

Authentication, profiles, lesson progress, AI usage, and Studio collaboration metadata now live in Neon. Supabase is retained only for binary shared Studio project files.

1. Create a Supabase project and a **private** Storage bucket named `studio-shared`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in local development and Vercel. The service role key is server-only; never prefix it with `NEXT_PUBLIC_` or expose it to browser code.
3. Run `studio_storage_limits.sql` in the Supabase SQL Editor after creating the bucket. This limits each shared project file to 25 MiB. The application uploads and downloads through its server API.

Do not run the older Supabase Auth or Postgres setup scripts in this directory for a new deployment. Their data is not used by the Neon-backed application.
