import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('Cloud edit lease is validated against the immutable asset code, not the Local UUID', async () => {
  const source = await read('../src/App.tsx')
  assert.match(source, /setCloudLease\(\{assetId:asset\.code,token:acquired\.lease\.lock_token/)
  assert.match(source, /lease\.assetId!==value\.code/)
  assert.doesNotMatch(source, /lease\.assetId!==value\.id/)
})
