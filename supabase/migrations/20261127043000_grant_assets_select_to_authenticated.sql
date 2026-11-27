-- Allow signed-in users to read assets through the existing organization-scoped RLS policies.
-- No write privileges are granted and RLS remains enabled.
GRANT SELECT ON TABLE public.assets TO authenticated;
