import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('Dexie v11 adds organization-scoped custom inventory groups without replacing existing Asset and inventory data', async () => {
  const db = await read('../src/db.ts')
  assert.match(db, /super\('baotri-mini-device-only'\)/)
  assert.match(db, /this\.version\(9\)\.stores/)
  assert.match(db, /this\.version\(10\)\.stores/)
  assert.match(db, /this\.version\(11\)\.stores/)
  for (const table of ['inventoryGroups','inventoryItems','inventoryMovements','inventoryMutations','inventoryCloudLinks','inventorySyncCursors']) {
    assert.match(db, new RegExp(table + ':'))
  }
  assert.match(db, /\[organizationId\+codeNormalized\]/)
  assert.match(db, /\[organizationId\+itemId\]/)
})

test('inventory metadata contract excludes quantity so metadata edits cannot overwrite stock', async () => {
  const source = await read('../src/lib/inventory.ts')
  assert.match(source, /InventoryItemMetadataInput = Omit<InventoryItemInput, 'openingQuantity'>/)
  assert.match(source, /Metadata editing intentionally has no quantity field/)
  assert.match(source, /function metadataSnapshot/)
  const metadata = source.slice(source.indexOf('function metadataSnapshot'), source.indexOf('async function assertCodeAvailable'))
  assert.doesNotMatch(metadata, /^\\s*quantity\\s*:/m)
})

test('inventory code is normalized and duplicate checking is tenant-scoped', async () => {
  const source = await read('../src/lib/inventory.ts')
  assert.match(source, /toLocaleUpperCase\('vi-VN'\)/)
  assert.match(source, /where\('\[organizationId\+codeNormalized\]'\)/)
  assert.match(source, /Mã vật tư .* đã tồn tại trong tổ chức/)
})

test('new material codes are generated sequentially and remain immutable during metadata edits', async () => {
  const source = await read('../src/lib/inventory.ts')
  const create = source.slice(source.indexOf('export async function createInventoryItem'), source.indexOf('/** Metadata editing intentionally'))
  const update = source.slice(source.indexOf('export async function updateInventoryItemMetadata'), source.indexOf('export async function postInventoryMovement'))
  assert.match(create, /const code = await nextInventoryCode\(actor\.organizationId\)/)
  assert.match(source, /const match = \/\^VT-\-?\(\\d\+\)\$\/i\.exec\(item\.code\.trim\(\)\)/)
  assert.match(source, /String\(next\)\.padStart\(3, '0'\)/)
  assert.doesNotMatch(update, /codeNormalized:|\n\s*code,/)
})

test('custom inventory groups are organization-scoped and duplicate names are normalized', async () => {
  const db = await read('../src/db.ts')
  const source = await read('../src/lib/inventory.ts')
  assert.match(db, /inventoryGroups: 'id, organizationId, \[organizationId\+nameNormalized\]/)
  assert.match(source, /export async function createInventoryGroup/)
  assert.match(source, /where\('\[organizationId\+nameNormalized\]'\)/)
  assert.match(source, /requirePermission\(actor\.canCreate, 'thêm nhóm vật tư'\)/)
})

test('creating an item with opening stock records item, opening movement and mutation in one transaction', async () => {
  const source = await read('../src/lib/inventory.ts')
  const create = source.slice(source.indexOf('export async function createInventoryItem'), source.indexOf('export async function updateInventoryItemMetadata'))
  assert.match(create, /db\.transaction\('rw', \[db\.inventoryItems, db\.inventoryMovements, db\.inventoryMutations\]/)
  assert.match(create, /movementRecord\(actor, \{ \.\.\.item, quantity: 0 \}, 'Nhập', openingQuantity, 'Tồn đầu kỳ'/)
  assert.match(create, /if \(movement\) await db\.inventoryMovements\.add\(movement\)/)
  assert.match(create, /await db\.inventoryMutations\.add\(mutation\)/)
  assert.match(create, /openingQuantity > 0/)
})

test('stock-in and stock-out validate positive quantities and prevent negative balances', async () => {
  const source = await read('../src/lib/inventory.ts')
  const post = source.slice(source.indexOf('export async function postInventoryMovement'), source.indexOf('export async function adjustInventoryCount'))
  assert.match(post, /validatePositive\(quantity, 'Số lượng'\)/)
  assert.match(post, /currentQuantity \+ delta < 0/)
  assert.match(post, /await db\.inventoryItems\.put\(next\)/)
  assert.match(post, /await db\.inventoryMovements\.add\(movement\)/)
  assert.match(post, /await db\.inventoryMutations\.add\(mutation\)/)
})

test('inventory count adjustment accepts counted quantity and creates no movement for no-change', async () => {
  const source = await read('../src/lib/inventory.ts')
  const adjust = source.slice(source.indexOf('export async function adjustInventoryCount'), source.indexOf('export async function archiveInventoryItem'))
  assert.match(adjust, /validateNonNegative\(countedQuantity, 'Số lượng kiểm kê'\)/)
  assert.match(adjust, /const delta = roundInventoryQuantity\(normalizedCounted - normalizedCurrent\)/)
  assert.match(adjust, /if \(delta === 0\) return \{ status: 'no_change'/)
  assert.match(adjust, /movementRecord\(actor, current, 'Điều chỉnh', delta/)
  assert.match(adjust, /countedQuantity/)
})

test('all inventory mutations are organization-scoped and permission checked locally', async () => {
  const source = await read('../src/lib/inventory.ts')
  assert.match(source, /requirePermission\(actor\.canCreate/)
  assert.match(source, /requirePermission\(actor\.canUpdate/)
  assert.match(source, /requirePermission\(actor\.canAdjust/)
  assert.match(source, /requirePermission\(actor\.canDelete && actor\.isAdmin/)
  assert.match(source, /roundInventoryQuantity\(current.quantity\) !== 0/)
  assert.match(source, /current\.organizationId !== actor\.organizationId/)
})

test('inventory movements preserve balance snapshots and actor information; no edit/delete API is exposed', async () => {
  const db = await read('../src/db.ts')
  const source = await read('../src/lib/inventory.ts')
  assert.match(db, /quantityDelta: number/)
  assert.match(db, /balanceBefore: number/)
  assert.match(db, /balanceAfter: number/)
  assert.match(db, /actorUserId\?: string/)
  assert.match(source, /balanceBefore/)
  assert.match(source, /balanceAfter/)
  assert.match(source, /performedBy/)
  assert.doesNotMatch(source, /deleteInventoryMovement|updateInventoryMovement/)
})

test('inventory numeric inputs are limited to six decimals and arithmetic is normalized', async () => {
  const source = await read('../src/lib/inventory.ts')
  assert.match(source, /function validateScale/)
  assert.match(source, /function roundInventoryQuantity/)
  assert.match(source, /const balanceAfter = roundInventoryQuantity\(balanceBefore \+ normalizedDelta\)/)
  assert.match(source, /const delta = roundInventoryQuantity\(normalizedCounted - normalizedCurrent\)/)
  assert.match(source, /if \(delta === 0\) return \{ status: 'no_change'/)
})

test('opening balance movement starts at zero and ends at the opening quantity', async () => {
  const source = await read('../src/lib/inventory.ts')
  const create = source.slice(source.indexOf('export async function createInventoryItem'), source.indexOf('export async function updateInventoryItemMetadata'))
  assert.match(create, /movementRecord\(actor, \{ \.\.\.item, quantity: 0 \}, 'Nhập', openingQuantity/)
})
