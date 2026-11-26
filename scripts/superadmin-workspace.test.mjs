import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const panel = await readFile(new URL('../src/PlatformAdminPanel.tsx', import.meta.url), 'utf8')

test('platform access is resolved by a server endpoint before organization membership gates', () => {
  const accessCheck = app.indexOf("supabase.functions.invoke('platform-check-access'")
  const route = app.indexOf("return <PlatformAdminPanel client={supabase} onClose={()=>{}} fullPage/>")
  const membershipGate = app.indexOf("if(session&&organizationContexts.length===0)")
  assert.notEqual(accessCheck, -1)
  assert.notEqual(route, -1)
  assert.ok(membershipGate > route)
  assert.doesNotMatch(app, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
})

test('SuperAdmin navigation contains platform management sections only', () => {
  assert.match(panel, /Tổng quan hệ thống/)
  assert.match(panel, /Quản lý tổ chức/)
  assert.match(panel, /Duyệt yêu cầu/)
  assert.match(panel, /Cấp dịch vụ/)
  assert.doesNotMatch(panel, /Tải Cloud → Local/)
})

test('standalone SuperAdmin layout has no modal close control and keeps existing platform approvals', () => {
  assert.match(panel, /fullPage\s*\?\s*'platform-admin-workspace'/)
  assert.match(panel, /PlatformPlanRequestsPanel client=\{client\}/)
  assert.match(panel, /platform-provision/)
})

const platformEndpoints = await Promise.all([
  '../supabase/functions/platform-get-overview/index.ts',
  '../supabase/functions/platform-create-customer/index.ts',
  '../supabase/functions/platform-manage-organization/index.ts',
  '../supabase/functions/platform-manage-plan-requests/index.ts',
  '../supabase/functions/platform-manage-asset-reset-requests/index.ts',
  '../supabase/functions/platform-check-access/index.ts',
].map(path => readFile(new URL(path, import.meta.url), 'utf8')))

test('platform Edge Functions use the server secret and verify the authenticated confirmed owner', () => {
  for (const source of platformEndpoints) {
    assert.match(source, /Deno\.env\.get\('PLATFORM_OWNER_EMAIL'\)/)
    assert.match(source, /auth\.getUser\(token\)/)
    assert.match(source, /email_confirmed_at/)
    assert.doesNotMatch(source, /\bOWNER_EMAIL\s*=/)
    assert.doesNotMatch(source, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  }
})

test('destructive platform decisions still require password re-authentication', () => {
  for (const source of [platformEndpoints[2], platformEndpoints[3], platformEndpoints[4]]) {
    assert.match(source, /signInWithPassword/)
    assert.match(source, /verified\.user\?\.id\s*!==\s*auth\.user\.id/)
  }
})


test('permanent organization deletion removes all newly added tenant audit metadata before the organization row', async () => {
  const migration = await readFile(new URL('../docs/drafts/20261126233000_fix_platform_delete_catalog_history_dependencies.sql', import.meta.url), 'utf8')
  const historyDelete = migration.indexOf("delete from public.organization_equipment_catalog_history")
  const catalogDelete = migration.indexOf("\n  delete from public.organization_equipment_catalog\n")
  const seedDelete = migration.indexOf("delete from private.platform_data_seed_runs")
  const membersDelete = migration.indexOf("delete from public.organization_members")
  const organizationDelete = migration.indexOf("delete from public.organizations")
  assert.ok(historyDelete > -1 && historyDelete < catalogDelete)
  assert.ok(seedDelete > -1 && seedDelete < membersDelete)
  assert.ok(membersDelete < organizationDelete)
  assert.match(migration, /to_regclass\('public\.organization_equipment_catalog_history'\)/)
  assert.match(migration, /'organization_equipment_catalog_history', v_catalog_history/)
  assert.match(migration, /'platform_data_seed_runs', v_seed_runs/)
  assert.doesNotMatch(migration, /delete from auth\.users|delete from public\.profiles/)
})

test('organization member management has no unused Super Admin identity bypass', async () => {
  const source = await readFile(new URL('../supabase/functions/manage-organization-members/index.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /OWNER_EMAIL/)
})
