import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('sync scheduler runs on startup, reconnect, focus and visible-tab return', async () => {
  const source = await read('../src/lib/syncEngine.ts')
  assert.match(source, /void execute\(\)/)
  assert.match(source, /addEventListener\('online'/)
  assert.match(source, /addEventListener\('focus'/)
  assert.match(source, /addEventListener\('visibilitychange'/)
  assert.match(source, /document\.visibilityState === 'hidden'/)
  assert.match(source, /if \(stopped \|\| \(options\.isActive/)
  assert.match(source, /if \(running\) \{\s*rerunRequested = true\s*return\s*\}/)
  assert.match(source, /while \\([\\s\\S]*rerunRequested[\\s\\S]*canContinueSync\\(\\)/)
  assert.match(source, /addEventListener\(SYNC_REQUEST_EVENT, onRequest\)/)
  assert.match(source, /clearInterval\(timer\)/)
})

test('sync scheduler uses a bounded polling interval and does not write data itself', async () => {
  const source = await read('../src/lib/syncEngine.ts')
  assert.match(source, /Math\.max\(15_000, options\.intervalMs \?\? 60_000\)/)
  assert.match(source, /options\.run\(\)/)
  assert.doesNotMatch(source, /\.rpc\(|\.put\(|\.update\(/)
})

test('mutation retry metadata supports exponential backoff and permanent failure hold', async () => {
  const db = await read('../src/db.ts')
  const cloud = await read('../src/lib/cloudAssets.ts')
  const app = await read('../src/App.tsx')
  assert.match(db, /nextAttemptAt\?: string/)
  assert.match(db, /failureKind\?: 'transient' \| 'permanent'/)
  assert.match(cloud, /Math\.min\(5000\*Math\.pow\(2,/)
  assert.match(cloud, /15\*60\*1000/)
  assert.match(cloud, /failureKind:conflict\|\|permanent\?'permanent':'transient'/)
  assert.match(cloud, /mutation\.nextAttemptAt&&Date\.parse\(mutation\.nextAttemptAt\)>Date\.now\(\)/)
  assert.match(app, /m\.failureKind!=='permanent'/)
  assert.match(app, /Date\.parse\(m\.nextAttemptAt\)<=Date\.now\(\)/)
})

test('permanent retry failures remain visible and can be explicitly retried by an authorized operator', async () => {
  const panel = await read('../src/CloudAssetsPanel.tsx')
  assert.match(panel, /failureKind:undefined,nextAttemptAt:undefined/)
  assert.match(panel, /m\.failureKind==='permanent'\?'Cần kiểm tra thủ công'/)
})

test('retry policy also schedules failures before Cloud mutation, including lock acquisition', async () => {
  const cloud = await read('../src/lib/cloudAssets.ts')
  const retry = cloud.slice(cloud.indexOf('export async function retryCloudAssetMutation'))
  assert.match(retry, /let acquiredLease:CloudLease\|undefined/)
  assert.match(retry, /try\{\s*const acquired=await acquireCloudAssetLock/)
  assert.match(retry, /lastAttemptAt:failedAt,deviceId/)
  assert.match(retry, /nextAttemptAt:conflict\|\|permanent\?undefined:new Date\(Date\.now\(\)\+jitteredDelay\)\.toISOString\(\)/)
  assert.match(retry, /if\(acquiredLease\)await releaseCloudAssetLock/)
})
