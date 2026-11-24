import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('organization account list shows an explicit total and visible list section', async () => {
  const source = await read('../src/OrganizationMembersPanel.tsx')
  assert.match(source, /member-list-section/)
  assert.match(source, /Danh sách thành viên/)
  assert.match(source, /filtered\.length.*members\.length/)
  assert.match(source, /member-list-wrap/)
})

test('organization member list does not use a nested fixed-height scroll area', async () => {
  const css = await read('../src/style.css')
  const section = css.slice(css.lastIndexOf('Organization members — show the complete account list'))
  assert.match(section, /\.member-list-wrap\s*\{[^}]*max-height:none/s)
  assert.match(section, /\.member-list-wrap\s*\{[^}]*overflow:visible/s)
  assert.match(section, /\.member-management-modal\s*\{[^}]*overflow-y:auto/s)
})

test('organization member controls and invite form use the shared sizing rules', async () => {
  const css = await read('../src/style.css')
  const section = css.slice(css.lastIndexOf('Organization members — show the complete account list'))
  assert.match(section, /\.member-action\s*\{[^}]*height:40px/s)
  assert.match(section, /\.member-search\s*\{[^}]*height:40px/s)
  assert.match(section, /\.member-invite-section \.field input,[\s\S]*?height:40px/)
  assert.match(section, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
})

test('member list markup fixes the escaped newline and groups member actions', async () => {
  const source = await read('../src/OrganizationMembersPanel.tsx')
  assert.equal(source.includes('\\n    <div className="member-list-wrap">'), false)
  assert.match(source, /<details className="member-action-menu">/)
  assert.match(source, /member-action-menu-list/)
})
test('member action menu has narrow-screen layout rules', async () => {
  const css = await read('../src/style.css')
  const section = css.slice(css.lastIndexOf('member list action menu and tighter responsive hierarchy'))
  assert.match(section, /\.member-action-menu-list/)
  assert.match(section, /@media\(max-width:680px\)[\s\S]*\.member-action-menu-list/)
})

test('member list uses compact columns and a compact icon-only action trigger', async () => {
  const css = await read('../src/style.css')
  const section = css.slice(css.lastIndexOf('compact member rows and low-footprint action trigger'))
  assert.match(section, /grid-template-columns:minmax\(0,1\.15fr\) minmax\(135px,\.8fr\) 38px/)
  assert.match(section, /member-action-menu summary span\{display:none\}/)
  assert.match(section, /member-action-menu-list button\{min-height:31px/)
  assert.match(section, /@media\(max-width:680px\)[\s\S]*grid-template-columns:minmax\(0,1fr\) 34px/)
})
