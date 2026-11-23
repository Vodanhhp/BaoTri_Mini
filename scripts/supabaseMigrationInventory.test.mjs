import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'

const appliedVersions = [
  "20261121022414",
  "20261121022440",
  "20261121022513",
  "20261121022858",
  "20261121023532",
  "20261121024116",
  "20261121024405",
  "20261121045631",
  "20261121094439",
  "20261121094441",
  "20261121094443",
  "20261121094444",
  "20261121094447",
  "20261121094449",
  "20261121094451",
  "20261121094453",
  "20261121094809",
  "20261121100426",
  "20261121120907",
  "20261121120954",
  "20261122032223",
  "20261122034136",
  "20261122034438",
  "20261122034910",
  "20261122055755",
  "20261122105818",
  "20261122105819",
  "20261122105821",
  "20261122124403",
  "20261122125135",
  "20261122133229",
  "20261122141731"
]

test('all Supabase Test applied migration versions have source files and no duplicate prefixes', async () => {
  const files = await readdir(new URL('../supabase/migrations/', import.meta.url))
  const versions = files.filter(file => file.endsWith('.sql')).map(file => file.slice(0,14))
  assert.equal(new Set(versions).size, versions.length, 'migration version prefixes must be unique')
  for (const version of appliedVersions) {
    assert.ok(versions.includes(version), 'missing source for applied migration '+version)
  }
})
