import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('organization name change is a private, tenant-scoped approval request with one pending request', async () => {
  const sql = await read('../supabase/migrations/20261124173000_organization_name_change_requests.sql')
  assert.match(sql, /create table private\.organization_name_change_requests/)
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on table private\.organization_name_change_requests from public, anon, authenticated/)
  assert.match(sql, /create unique index organization_name_change_one_pending_per_org[\s\S]*?where status = 'pending'/)
  assert.match(sql, /m\.organization_id=p_organization_id[\s\S]*?m\.role='admin'[\s\S]*?m\.status='active'/)
  assert.match(sql, /for update/)
  assert.match(sql, /char_length\(v_name\) < 2 or char_length\(v_name\) > 160/)
})

test('approval changes only organization name and keeps a review history', async () => {
  const sql = await read('../supabase/migrations/20261124173000_organization_name_change_requests.sql')
  assert.match(sql, /old_name text not null/)
  assert.match(sql, /requested_name text not null/)
  assert.match(sql, /reviewer_user_id uuid/)
  assert.match(sql, /reviewed_at timestamptz/)
  assert.match(sql, /if p_decision='approve' then[\s\S]*?update public\.organizations set name=v_request\.requested_name/)
  assert.doesNotMatch(sql, /delete from public\.(assets|inventory_items|inventory_movements|organization_members)/)
  assert.match(sql, /grant execute on function public\.review_organization_name_change_request\(uuid,uuid,text,text\) to service_role/)
})

test('organization request endpoint authenticates an active Admin and sends a review request only', async () => {
  const source = await read('../supabase/functions/organization-name-change-requests/index.ts')
  assert.match(source, /admin\.auth\.getUser\(token\)/)
  assert.match(source, /member\?\.role!=='admin'\|\|member\.status!=='active'/)
  assert.match(source, /create_organization_name_change_request/)
  assert.match(source, /list_organization_name_change_requests/)
  assert.doesNotMatch(source, /from\('organizations'\)\.update/)
})

test('platform endpoint requires owner identity, password reauthentication and explicit confirmation', async () => {
  const source = await read('../supabase/functions/platform-manage-organization-name-change-requests/index.ts')
  assert.match(source, /auth\.user\.email\?\.toLowerCase\(\)!==owner/)
  assert.match(source, /signInWithPassword/)
  assert.match(source, /confirmation!=='yes'/)
  assert.match(source, /review_organization_name_change_request/)
})

test('subscription UI shows current name, request history and a separate Super Admin review queue', async () => {
  const source = await read('../src/PlanChangePanels.tsx')
  assert.match(source, /export function OrganizationNameChangeRequestPanel/)
  assert.match(source, /Tên đang sử dụng/)
  assert.match(source, /Lịch sử yêu cầu đổi tên/)
  assert.match(source, /export function PlatformNameChangeRequestsPanel/)
  assert.match(source, /Phê duyệt tên doanh nghiệp mới/)
  assert.match(source, /OrganizationNameChangeRequestPanel client=\{client\} organizationId=\{organizationId\}/)
})
