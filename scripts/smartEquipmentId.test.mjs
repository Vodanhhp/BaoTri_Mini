import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// Compile the pure TypeScript engine in memory; tests do not write to Supabase
// or IndexedDB and do not allocate official equipment sequences.
const source = await readFile(new URL('../src/lib/smartEquipmentId.ts', import.meta.url), 'utf8')
const compiled = ts.transpile(source, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  strict: true
})
const engineUrl = 'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
const { analyzeEquipmentName, formatEquipmentId } = await import(engineUrl)

const catalog = {
  equipmentGroups: [
    { code: 'NUO', name: 'Bơm nước', aliases: ['Bơm', 'Cấp nước'], availableFromPlan: 'B' },
    { code: 'KHI', name: 'Khí nén', aliases: ['Máy nén'], availableFromPlan: 'B' },
    { code: 'CNC-T', name: 'Gia công CNC', availableFromPlan: 'C' }
  ],
  equipmentDictionary: [
    { standardName: 'Bơm nước', shortCode: 'BOM', aliases: ['máy bơm nước', 'bom nuoc'], suggestedGroup: 'NUO' },
    { standardName: 'Máy nén khí', shortCode: 'NEN', aliases: ['may nen khi'], suggestedGroup: 'KHI' },
    { standardName: 'Máy tiện CNC', shortCode: 'MTC', aliases: ['tien cnc'], suggestedGroup: 'CNC-T' }
  ]
}

const analyze = (overrides = {}) => analyzeEquipmentName({
  name: 'Máy bơm nước',
  plan: 'B',
  catalog,
  ...overrides
})

test('Plan A formats ID without group/site/date', () => {
  assert.equal(formatEquipmentId({ plan: 'A', equipmentCode: 'b.o.m', sequence: 1 }), 'BOM-001')
})

test('Plan B formats ID with normalized group code only', () => {
  assert.equal(formatEquipmentId({ plan: 'B', equipmentCode: 'bom', groupCode: 'nuo', sequence: 12 }), 'BOM-NUO-012')
})

test('Plan C formats site and commissioning month/year', () => {
  assert.equal(formatEquipmentId({
    plan: 'C', equipmentCode: 'bom', groupCode: 'nuo', siteCode: '01',
    sequence: 1, commissionedAt: '2026-11-21'
  }), 'BOM-NUO-01-001-1126')
})

test('Plan D uses the same extended ID structure as Plan C', () => {
  assert.equal(formatEquipmentId({
    plan: 'D', equipmentCode: 'NEN', groupCode: 'KHI', siteCode: '02',
    sequence: 1000, commissionedAt: '2026-02-01'
  }), 'NEN-KHI-02-1000-0226')
})

test('sequence must be a positive safe integer', () => {
  for (const sequence of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.throws(() => formatEquipmentId({ plan: 'A', equipmentCode: 'BOM', sequence }))
  }
})

test('equipment code must normalize to 2–4 alphanumeric characters', () => {
  for (const equipmentCode of ['', 'A', 'TOOLONG']) {
    assert.throws(() => formatEquipmentId({ plan: 'A', equipmentCode, sequence: 1 }))
  }
})

test('Plan B/C/D require a valid 2–4 character group code', () => {
  for (const groupCode of [undefined, '', 'A', 'TOOLONG']) {
    assert.throws(() => formatEquipmentId({ plan: 'B', equipmentCode: 'BOM', groupCode, sequence: 1 }))
  }
})

test('Plan C/D reject malformed site codes and invalid commissioning dates', () => {
  assert.throws(() => formatEquipmentId({
    plan: 'C', equipmentCode: 'BOM', groupCode: 'NUO', siteCode: '1',
    sequence: 1, commissionedAt: '2026-11-21'
  }))
  for (const commissionedAt of [undefined, '2026-02-30', '21-11-2026']) {
    assert.throws(() => formatEquipmentId({
      plan: 'D', equipmentCode: 'BOM', groupCode: 'NUO', siteCode: '01',
      sequence: 1, commissionedAt
    }))
  }
})

test('normalizes Vietnamese accents, case and punctuation when matching', () => {
  const result = analyze({ name: '  MAY BOM NUOC  ', plan: 'A' })
  assert.equal(result.status, 'matched')
  assert.equal(result.equipmentCode, 'BOM')
  assert.equal(result.normalizedName, 'Bơm nước')
})

test('Plan A does not require a group and rejects an explicitly selected group', () => {
  const valid = analyze({ plan: 'A' })
  assert.equal(valid.status, 'matched')
  assert.equal(valid.requiresUserConfirmation, false)
  assert.equal(valid.groupCode, undefined)
  assert.equal(analyze({ plan: 'A', selectedGroupCode: 'NUO' }).status, 'invalid-input')
})

test('Plan B suggestion is not treated as user confirmation', () => {
  const result = analyze()
  assert.equal(result.status, 'matched')
  assert.equal(result.groupCode, 'NUO')
  assert.equal(result.requiresUserConfirmation, true)
  assert.equal(result.canPrepareId, true)
})

test('Plan B explicit group selection clears confirmation requirement', () => {
  const result = analyze({ selectedGroupCode: 'n.u.o' })
  assert.equal(result.status, 'matched')
  assert.equal(result.groupCode, 'NUO')
  assert.equal(result.requiresUserConfirmation, false)
})

test('Plan B rejects a group unavailable until Plan C', () => {
  const result = analyze({ name: 'Máy tiện CNC', selectedGroupCode: 'CNC-T' })
  assert.equal(result.status, 'invalid-input')
  assert.equal(result.canPrepareId, false)
})

test('Plan C requires a valid commissioning date before preparing an ID', () => {
  assert.equal(analyze({ plan: 'C', selectedGroupCode: 'NUO' }).status, 'missing-commissioning-date')
  assert.equal(analyze({ plan: 'C', selectedGroupCode: 'NUO', commissionedAt: '2026-02-30' }).status, 'missing-commissioning-date')
  const result = analyze({ plan: 'C', selectedGroupCode: 'NUO', commissionedAt: '2024-02-29' })
  assert.equal(result.status, 'matched')
  assert.equal(result.siteCode, '00')
})

test('Plan C/D reject invalid site codes', () => {
  assert.equal(analyze({
    plan: 'D', selectedGroupCode: 'NUO', siteCode: '1', commissionedAt: '2026-11-21'
  }).status, 'invalid-input')
})

test('unknown equipment is not assigned a guessed code', () => {
  const result = analyze({ name: 'Thiết bị hoàn toàn không có trong danh mục' })
  assert.equal(result.status, 'not-found')
  assert.equal(result.canPrepareId, false)
  assert.equal(result.equipmentCode, undefined)
})

test('near-equal matches with different codes are marked ambiguous', () => {
  const ambiguousCatalog = {
    equipmentGroups: catalog.equipmentGroups,
    equipmentDictionary: [
      { standardName: 'Bơm công nghiệp', shortCode: 'BOM', aliases: ['bơm tổng hợp'], suggestedGroup: 'NUO' },
      { standardName: 'Bơm công nghiệp khác', shortCode: 'BPK', aliases: ['bơm tổng hợp'], suggestedGroup: 'NUO' }
    ]
  }
  const result = analyze({ name: 'bơm tổng hợp', catalog: ambiguousCatalog })
  assert.equal(result.status, 'ambiguous')
  assert.equal(result.canPrepareId, false)
  assert.equal(result.matches.length, 2)
})

test('normalized duplicate group codes are rejected', () => {
  const duplicateCatalog = {
    ...catalog,
    equipmentGroups: [
      { code: 'CNC-T', name: 'CNC 1' },
      { code: 'CNCT', name: 'CNC 2' }
    ]
  }
  assert.equal(analyze({ catalog: duplicateCatalog }).status, 'invalid-input')
})

test('suggested or selected group missing from organization snapshot is rejected', () => {
  assert.equal(analyze({ selectedGroupCode: 'ABC' }).status, 'missing-group')
  const noSuggestedGroup = {
    ...catalog,
    equipmentDictionary: [{ standardName: 'Bơm nước', shortCode: 'BOM' }]
  }
  assert.equal(analyze({ catalog: noSuggestedGroup }).status, 'missing-group')
})

test('customer-defined equipment dictionary entries can be matched without mutating standard catalog', () => {
  const originalCount = catalog.equipmentDictionary.length
  const result = analyze({
    name: 'máy lọc dầu',
    customEquipmentDictionary: [{ standardName: 'Máy lọc dầu', shortCode: 'MLD', suggestedGroup: 'NUO' }]
  })
  assert.equal(result.status, 'matched')
  assert.equal(result.equipmentCode, 'MLD')
  assert.equal(catalog.equipmentDictionary.length, originalCount)
})

test('customer-defined groups are recognized from the organization snapshot', () => {
  const result = analyze({
    name: 'máy bơm nước',
    selectedGroupCode: 'PMP',
    customGroups: [{ code: 'PMP', name: 'Nhóm bơm riêng', availableFromPlan: 'B' }]
  })
  assert.equal(result.status, 'matched')
  assert.equal(result.groupCode, 'PMP')
})

test('preview ID uses the same formatter and supports sequence above 999', () => {
  const result = analyze({ plan: 'C', selectedGroupCode: 'NUO', siteCode: '03', commissionedAt: '2026-11-21', previewSequence: 1000 })
  assert.equal(result.status, 'matched')
  assert.equal(result.previewId, 'BOM-NUO-03-1000-1126')
})


const standardConfig = JSON.parse(await readFile(new URL('../public/data/baotri-config.json', import.meta.url), 'utf8'))

test('published standard catalog supports Plan A generation without group selection', () => {
  const result = analyzeEquipmentName({
    name: 'Máy bơm nước',
    plan: 'A',
    catalog: {
      equipmentGroups: standardConfig.equipmentGroups,
      equipmentDictionary: standardConfig.equipmentDictionary
    },
    previewSequence: 1
  })
  assert.equal(result.status, 'matched')
  assert.equal(result.previewId, 'BOM-001')
  assert.equal(result.requiresUserConfirmation, false)
})

test('published standard catalog supports Plan B after explicit group confirmation', () => {
  const result = analyzeEquipmentName({
    name: 'Máy bơm nước',
    plan: 'B',
    catalog: {
      equipmentGroups: standardConfig.equipmentGroups,
      equipmentDictionary: standardConfig.equipmentDictionary
    },
    selectedGroupCode: 'NUO',
    previewSequence: 1
  })
  assert.equal(result.status, 'matched')
  assert.equal(result.previewId, 'BOM-NUO-001')
  assert.equal(result.requiresUserConfirmation, false)
})

test('published standard catalog supports Plan C/D with site and commissioning date', () => {
  for (const plan of ['C', 'D']) {
    const result = analyzeEquipmentName({
      name: 'Máy nén khí',
      plan,
      catalog: {
        equipmentGroups: standardConfig.equipmentGroups,
        equipmentDictionary: standardConfig.equipmentDictionary
      },
      selectedGroupCode: 'NEN',
      siteCode: '01',
      commissionedAt: '2026-11-21',
      previewSequence: 1000
    })
    assert.equal(result.status, 'matched')
    assert.equal(result.previewId, 'NEN-NEN-01-1000-1126')
  }
})
