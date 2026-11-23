import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const panel = await readFile(new URL('../src/PlatformAdminPanel.tsx', import.meta.url), 'utf8')

test('authenticated SuperAdmin enters the platform workspace before organization membership gates', () => {
  const route = app.indexOf("return <PlatformAdminPanel client={supabase} onClose={()=>{}} fullPage/>")
  const membershipGate = app.indexOf("if(session&&organizationContexts.length===0)")
  assert.notEqual(route, -1)
  assert.ok(membershipGate > route)
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
].map(path => readFile(new URL(path, import.meta.url), 'utf8')))

test('platform Edge Functions verify the access token and confirmed platform-owner identity server-side', () => {
  for (const source of platformEndpoints) {
    assert.match(source, /admin\.auth\.getUser\(token\)/)
    assert.match(source, /email_confirmed_at/)
    assert.match(source, /OWNER_EMAIL/)
  }
})

test('destructive organization and plan decisions require password re-authentication', () => {
  for (const source of [platformEndpoints[2], platformEndpoints[3]]) {
    assert.match(source, /signInWithPassword/)
    assert.match(source, /verified\.user\?\.id\s*!==\s*auth\.user\.id/)
  }
})
