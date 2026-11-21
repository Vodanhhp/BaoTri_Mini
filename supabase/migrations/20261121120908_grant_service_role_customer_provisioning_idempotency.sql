-- The public wrapper is SECURITY INVOKER, so service_role must be allowed to execute its private SECURITY DEFINER implementation.
grant execute on function private.platform_provision_customer_idempotent(uuid,text,uuid,uuid,text,text) to service_role;
