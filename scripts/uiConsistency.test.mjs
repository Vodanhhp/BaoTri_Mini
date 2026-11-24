import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('app-wide UI tokens define shared control sizes and spacing', async () => {
  const css = await read('../src/style.css')
  assert.match(css, /--ui-control-height:40px/)
  assert.match(css, /--ui-button-height:40px/)
  assert.match(css, /--ui-space-1:4px/)
  assert.match(css, /--ui-space-2:8px/)
  assert.match(css, /--ui-space-3:12px/)
  assert.match(css, /--ui-space-4:16px/)
  assert.match(css, /--ui-space-5:24px/)
  assert.match(css, /#root \.app-shell button\s*\{[^}]*min-height:var\(--ui-button-height\)/s)
})

test('buttons and one-line form controls share dimensions across modules', async () => {
  const css = await read('../src/style.css')
  assert.match(css, /height:var\(--ui-button-height\)/)
  assert.match(css, /height:var\(--ui-control-height\)/)
  assert.match(css, /min-height:var\(--ui-control-height\)/)
  assert.match(css, /#root \.app-shell \.field :is\(input[^]*?width:100%/s)
  assert.match(css, /#root \.app-shell \.mobile-nav-item\s*\{[^}]*min-height:48px/s)
})

test('standard tables are compact by default and wide tables opt in explicitly', async () => {
  const css = await read('../src/style.css')
  const standard = css.slice(css.lastIndexOf('BAOTRI Mini — app-wide UI consistency layer'))
  assert.match(standard, /table-layout:fixed/)
  assert.match(standard, /min-width:0/)
  assert.match(standard, /padding:8px 10px/)
  assert.match(standard, /font-size:12px!important/)
  assert.match(standard, /platform-org-table table\s*\{[^}]*min-width:780px/s)
})

test('the written UI standard documents the same control and table rules', async () => {
  const doc = await read('../docs/UI_TABLE_STANDARD.md')
  assert.match(doc, /cao \*\*40px\*\*/)
  assert.match(doc, /min-width: 0/)
  assert.match(doc, /Padding ô \| 8px 10px/)
  assert.match(doc, /4 \/ 8 \/ 12 \/ 16 \/ 24px/)
})
