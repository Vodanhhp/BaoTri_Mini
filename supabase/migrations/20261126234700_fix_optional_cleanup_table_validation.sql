create or replace function private.delete_organization_rows_if_table_exists(p_table_name text,p_organization_id uuid)
returns integer language plpgsql security definer set search_path='' set row_security='off'
as $$
declare v_table regclass;v_count integer:=0;
begin
 if not (p_table_name like 'public.%' or p_table_name like 'private.%')
    or length(split_part(p_table_name,'.',2))=0
    or p_table_name like '%.%.%' then
  raise exception 'Invalid organization cleanup table name.';
 end if;
 v_table:=to_regclass(p_table_name);
 if v_table is null then return 0;end if;
 execute format('delete from %s where organization_id=$1',v_table) using p_organization_id;
 get diagnostics v_count=row_count;
 return v_count;
end;$$;
revoke all on function private.delete_organization_rows_if_table_exists(text,uuid) from public,anon,authenticated;