-- The trusted service_role boundary is enforced by EXECUTE grants on both
-- provisioning entry points. The inner SECURITY DEFINER function must not
-- inspect request.jwt.claim.role because service API keys can be mapped by
-- the Supabase gateway without setting that legacy JWT claim.

do $migration$
declare
  v_definition text;
  v_guard text := E'  if coalesce(pg_catalog.current_setting(''request.jwt.claim.role'',true),'''') <> ''service_role'' then\n    raise exception ''Only the trusted platform provisioning service may create customer organizations'' using errcode = ''42501'';\n  end if;\n\n';
begin
  select pg_catalog.pg_get_functiondef(
    'private.platform_provision_customer(text,uuid,uuid,text,text)'::regprocedure
  ) into v_definition;

  if position(v_guard in v_definition) = 0 then
    raise exception 'Expected obsolete service-role JWT guard was not found; refusing to modify function';
  end if;

  v_definition := replace(v_definition, v_guard, '');
  execute v_definition;
end
$migration$;
