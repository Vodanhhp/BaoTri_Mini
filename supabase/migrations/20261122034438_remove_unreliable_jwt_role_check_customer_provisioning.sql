-- Provisioning authorization is enforced by EXECUTE grants on the public
-- wrapper and private implementation. Supabase secret API keys are mapped to
-- service_role by the gateway but do not reliably populate auth.role().
-- Therefore do not duplicate the authorization check via JWT claim inspection.

create or replace function private.platform_provision_customer_idempotent(
  p_request_id uuid,
  p_organization_name text,
  p_actor_user_id uuid,
  p_admin_user_id uuid,
  p_admin_email text,
  p_plan_code text
) returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $function$
declare
  v_existing private.platform_customer_provision_requests;
  v_result jsonb;
  v_name text := btrim(coalesce(p_organization_name,''));
  v_email text := lower(btrim(coalesce(p_admin_email,'')));
  v_plan text := upper(btrim(coalesce(p_plan_code,'')));
begin
  if p_request_id is null then
    raise exception 'Provisioning request ID is required' using errcode='22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));

  select * into v_existing
  from private.platform_customer_provision_requests r
  where r.request_id=p_request_id;

  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id
      or v_existing.admin_user_id is distinct from p_admin_user_id
      or v_existing.admin_email is distinct from v_email
      or v_existing.organization_name is distinct from v_name
      or v_existing.plan_code is distinct from v_plan then
      raise exception 'This provisioning request ID is already bound to different customer details' using errcode='23505';
    end if;
    return v_existing.result;
  end if;

  v_result := private.platform_provision_customer(
    v_name,p_actor_user_id,p_admin_user_id,v_email,v_plan
  );

  insert into private.platform_customer_provision_requests(
    request_id,actor_user_id,admin_user_id,admin_email,organization_name,plan_code,result
  ) values (
    p_request_id,p_actor_user_id,p_admin_user_id,v_email,v_name,v_plan,v_result
  );

  return v_result;
end;
$function$;
