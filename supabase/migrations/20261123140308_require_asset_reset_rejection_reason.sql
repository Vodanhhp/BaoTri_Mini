-- Require a meaningful explanation whenever Superadmin rejects an asset reset request.
begin;

create or replace function public.review_organization_asset_reset_request(
  p_request_id uuid,
  p_reviewer_user_id uuid,
  p_decision text,
  p_review_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_request private.organization_asset_reset_approval_requests;
  v_reset jsonb;
  v_error text;
begin
  if p_reviewer_user_id is null then
    raise exception 'Reviewer is required' using errcode='22023';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception 'Decision is invalid' using errcode='22023';
  end if;
  if p_decision='reject' and length(btrim(coalesce(p_review_note,'')))=0 then
    raise exception 'Bắt buộc nhập lý do từ chối yêu cầu Reset.' using errcode='22023';
  end if;

  select * into v_request
    from private.organization_asset_reset_approval_requests
   where id=p_request_id for update;
  if not found then
    raise exception 'Không tìm thấy yêu cầu Reset.' using errcode='P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Yêu cầu đã được xử lý hoặc không còn ở trạng thái chờ duyệt.' using errcode='55000';
  end if;

  if p_decision='reject' then
    update private.organization_asset_reset_approval_requests
       set status='rejected',reviewed_by_user_id=p_reviewer_user_id,
           reviewed_at=clock_timestamp(),review_note=left(btrim(p_review_note),1000)
     where id=p_request_id;
    return jsonb_build_object('status','rejected','request_id',p_request_id);
  end if;

  update private.organization_asset_reset_approval_requests
     set status='approved',reviewed_by_user_id=p_reviewer_user_id,
         reviewed_at=clock_timestamp(),review_note=left(coalesce(p_review_note,''),1000)
   where id=p_request_id;

  begin
    v_reset := public.platform_reset_organization_assets(
      v_request.organization_id,v_request.request_id,p_reviewer_user_id
    );
    update private.organization_asset_reset_approval_requests
       set status='executed',executed_at=clock_timestamp(),
           reset_generation=nullif(v_reset->>'generation','')::bigint,
           assets_deleted=nullif(v_reset->>'assets_deleted','')::bigint,
           execution_error=null
     where id=p_request_id;
    return jsonb_build_object('status','executed','request_id',p_request_id,'reset',v_reset);
  exception when others then
    get stacked diagnostics v_error = message_text;
    update private.organization_asset_reset_approval_requests
       set status='failed',execution_error=left(v_error,1000)
     where id=p_request_id;
    return jsonb_build_object('status','failed','request_id',p_request_id,'error',v_error);
  end;
end;
$function$;

revoke all on function public.review_organization_asset_reset_request(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_organization_asset_reset_request(uuid,uuid,text,text) to service_role;

commit;
