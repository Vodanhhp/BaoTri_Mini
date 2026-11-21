begin;
do $test$
declare u uuid:=gen_random_uuid();org uuid;member_id uuid;role_id uuid;asset_id uuid:=gen_random_uuid();mutation_id uuid:=gen_random_uuid();payload jsonb;imported jsonb;lockdata jsonb;updated jsonb;replay jsonb;expected timestamptz;
begin
 insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(u,'authenticated','authenticated','wrap-check-'||u||'@example.invalid','',now(),'{}','{}',now(),now());
 insert into public.organizations(name,created_by)values('Wrapper test',u)returning id into org;
 select id into role_id from public.roles where organization_id=org and code='admin';
 insert into public.organization_members(organization_id,user_id,role,status)values(org,u,'admin','active')returning id into member_id;
 insert into public.member_roles(organization_id,member_id,role_id)values(org,member_id,role_id);
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u::text,'role','authenticated')::text,true);
 payload:=jsonb_build_object('name','Wrapper test equipment','category','Thiết bị điện','brand','','model','','serial','','location','','commissioned_at',null,'power','','cycle','','cycle_started_at',null,'transferred_from_other_facility',false,'status','Đang hoạt động','notes','','archived_at',null,'created_at',now(),'updated_at',now(),'created_by_user_id',u,'created_by_label','test');
 imported:=public.import_asset_preserving_identity(org,asset_id,'WRAP-001',payload,asset_id);
 lockdata:=public.acquire_asset_edit_lock(org,asset_id,'test-device','Test device');
 if lockdata->>'acquired'<>'true' then raise exception 'public invoker wrapper failed lock';end if;
 expected:=(imported->'asset'->>'updated_at')::timestamptz;
 updated:=public.apply_asset_mutation_with_lock(org,asset_id,(lockdata->>'lock_token')::uuid,mutation_id,expected,jsonb_build_object('name','Changed by wrapper','brand','','model','','serial','','location','','commissioned_at',null,'power','','cycle','','cycle_started_at',null,'transferred_from_other_facility',false,'status','Đang hoạt động','notes','','archived_at',null));
 if updated->'asset'->>'name'<>'Changed by wrapper' then raise exception 'wrapper update failed';end if;
 replay:=public.apply_asset_mutation_with_lock(org,asset_id,(lockdata->>'lock_token')::uuid,mutation_id,expected,jsonb_build_object('name','Changed by wrapper','brand','','model','','serial','','location','','commissioned_at',null,'power','','cycle','','cycle_started_at',null,'transferred_from_other_facility',false,'status','Đang hoạt động','notes','','archived_at',null));
 if replay->>'already_applied'<>'true' then raise exception 'receipt replay failed';end if;
 if not public.release_asset_edit_lock(org,asset_id,(lockdata->>'lock_token')::uuid) then raise exception 'release wrapper failed';end if;
end;$test$;
rollback;