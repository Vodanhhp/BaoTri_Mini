import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('dashboard, equipment and inventory share live organization Plan/Catalog summary', async () => {
  const app = await read('../src/App.tsx')
  const inventory = await read('../src/InventoryPanel.tsx')
  const summary = await read('../src/OrganizationPlanSummary.tsx')
  assert.match(app, /<OrganizationPlanSummary catalog=\{equipmentCatalog\} loading=\{equipmentCatalogLoading\} error=\{equipmentCatalogError\}/)
  assert.match(app, /equipmentCatalog=\{equipmentCatalog\} equipmentCatalogLoading=\{equipmentCatalogLoading\} equipmentCatalogError=\{equipmentCatalogError\}/)
  assert.match(inventory, /className="welcome inventory-welcome"/)
  assert.match(inventory, /<OrganizationPlanSummary catalog=\{equipmentCatalog\}/)
  assert.match(summary, /catalog\.plan_code/)
  assert.match(summary, /catalog\.snapshot\.plan\?\.name/)
  assert.match(summary, /catalog\.source_data_version/)
  assert.doesNotMatch(summary, /Plan A/)
})
