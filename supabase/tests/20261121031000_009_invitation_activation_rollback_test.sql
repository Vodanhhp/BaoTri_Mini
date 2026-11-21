begin;
do $test$
declare u uuid:=gen_random_uuid();org uuid;member_id uuid;role_id uuid;
begin
 insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(u,'authenticated','authenticated','confirm-check-'||u||'@example.invalid','',null,'{}','{}',now(),now());
 if not exists(select 1 from public.profiles where id=u)then raise exception 'profile trigger did not create profile';end if;
 insert into public.organizations(name,created_by)values('Confirm trigger test',u) returning id into org;
 select id into role_id from public.roles where organization_id=org and code='technician';
 insert into public.organization_members(organization_id,user_id,role,status)values(org,u,'user','invited')returning id into member_id;
 insert into public.member_roles(organization_id,member_id,role_id)values(org,member_id,role_id);
 update auth.users set email_confirmed_at=now() where id=u;
 if not exists(select 1 from public.organization_members where id=member_id and status='active')then raise exception 'invited membership not activated after email confirmation';end if;
end;$test$;
rollback;