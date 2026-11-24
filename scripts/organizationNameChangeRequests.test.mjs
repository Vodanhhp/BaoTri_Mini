import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL(path,import.meta.url),'utf8')

test('organization name change workflow keeps tenant requests pending until verified Super Admin review',async()=>{
 const migration=await read('../docs/pending-migrations/20261124165000_organization_name_change_requests.sql')
 const tenant=await read('../supabase/functions/organization-name-change-requests/index.ts')
 const platform=await read('../supabase/functions/platform-manage-organization-name-requests/index.ts')
 assert.match(migration,/organization_name_change_one_pending_per_org/)
 assert.match(migration,/Only an active organization Admin may request a name change/)
 assert.match(migration,/Only the verified platform owner may review organization name changes/)
 assert.match(migration,/update public\.organizations set name=v_request\.requested_name/)
 assert.match(migration,/organization_name_change_history/)
 assert.match(migration,/revoke all on table private\.organization_name_change_requests from public,anon,authenticated,service_role/)
 assert.match(tenant,/membership\.role!=='admin'\|\|membership\.status!=='active'/)
 assert.match(tenant,/action==='submit'/)
 assert.match(platform,/auth\.user\.email\?\.toLowerCase\(\)!==ownerEmail/)
 assert.match(platform,/signInWithPassword/)
 assert.ok(platform.includes("if(!['approve','reject'].includes(action))"))
 assert.match(platform,/Bắt buộc nhập lý do từ chối yêu cầu/)
})

test('name change approval preserves organization identity and existing business data',async()=>{
 const migration=await read('../docs/pending-migrations/20261124165000_organization_name_change_requests.sql')
 assert.match(migration,/previous_name text not null/)
 assert.match(migration,/new_name text not null/)
 assert.match(migration,/organization_id uuid not null references public\.organizations\(id\) on delete cascade/)
 assert.match(migration,/current_name is distinct from v_request\.current_name/)
 assert.doesNotMatch(migration,/delete from public\.(assets|inventory_items|inventory_movements|organization_members)/i)
})
