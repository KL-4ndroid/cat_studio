-- Explicit least-privilege grants for the Vercel server's service role.
-- Required when Supabase does not automatically grant new public tables to service_role.
grant select on public.studio_config, public.studio_palette_versions to service_role;
