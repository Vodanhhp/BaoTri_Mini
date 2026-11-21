# Smart Equipment ID Engine — implementation notes

## 1. Purpose

Implement the shared deterministic engine that analyzes an equipment name, resolves an equipment dictionary entry and group, and formats a Plan A/B/C/D management ID preview.

The engine is shared across Plans. It does not persist equipment, allocate official sequence numbers, or change an existing identifier.

## 2. Existing application mapping

The current application already has these fields in `src/db.ts`:

| Current field | Meaning in the ID design |
|---|---|
| `Asset.id` | Existing stable UUID primary key; reuse it as the equipment UUID |
| `Asset.code` | Business management ID |
| `Asset.name` | Real-world/display name; editable by Admin and KTV under permissions |
| `Asset.category` | Current equipment group; Admin may change it without changing the business ID |

Do not create a second UUID field without a specific migration requirement.

## 3. Engine module

File: `src/lib/smartEquipmentId.ts`

Responsibilities:
- Normalize Vietnamese names for matching without overwriting the user's real-world name.
- Match standard names and aliases in the Organization's catalog snapshot.
- Accept Organization-specific equipment dictionary entries and groups separately from standard catalog data.
- Resolve an explicit user-selected group before considering the dictionary's suggested group.
- Return ambiguity and missing-data states instead of guessing.
- Format the Plan-specific ID pattern when a preview sequence is supplied.
- Generate UUID v4 for new equipment when needed.

The module is deterministic and has no database/network dependency.

## 4. ID format rules

- Plan A: `EQUIPMENT_CODE-SEQUENCE`
- Plan B: `EQUIPMENT_CODE-GROUP_CODE-SEQUENCE`
- Plan C/D: `EQUIPMENT_CODE-GROUP_CODE-SITE_CODE-SEQUENCE-MMYY`

Equipment code and group code are normalized to 2–4 alphanumeric characters. Existing catalog short codes containing punctuation (for example `CNC-T`) are normalized by removing punctuation (`CNCT`).

Plan C/D require a valid confirmed commissioning date. Site code defaults to `00` and must be two digits.

## 5. Preview versus official allocation

The engine's `previewSequence` is only for a provisional display. It is never a reservation and must never be written as the official ID.

The official sequence must be allocated atomically as part of the save transaction, with a database-level uniqueness constraint scoped to the Organization. A failed save must not leave a committed ID without its equipment record.

The current JSON defines the Plan C/D counter scope but does not explicitly define Plan A/B counter scopes. Do not silently invent those scopes during database implementation; resolve them as a business rule first.

## 6. Catalog snapshot isolation

The engine receives catalog data from its caller. For an existing Organization, the caller must supply that Organization's own snapshot plus its custom additions. It must not fetch the latest standard JSON as a live fallback.

The standard JSON is only an initialization source for a new Organization snapshot.

## 7. Integration prerequisites found in the current application

The current application is not yet ready for full end-to-end ID generation:

1. `organizations` currently has no Plan field.
2. No Organization catalog snapshot persistence/reader is present in the current application.
3. The add-equipment form currently asks the user to type `Asset.code` manually.
4. Equipment groups in the form are currently a static hard-coded list, not the Organization snapshot.
5. The Cloud edit-save path currently preserves the previous `code` and `category`; it therefore does not yet support the approved Admin group-change rule.
6. There is no atomic official ID sequence allocator yet.

Full integration requires a reviewed database migration/RPC, tenant-isolated snapshot storage and RLS, organization Plan context, and changes to the asset save path. These are separate from this deterministic engine and must be implemented and verified without weakening existing Local/Cloud locking and sync guarantees.

## 8. Immutable identity and editable operational information

- `Asset.id` / UUID is stable for the asset lifetime.
- `Asset.code` / business ID is immutable after save.
- `Asset.name` is the editable real-world name and never regenerates the ID.
- `Asset.category` is the current group; Admin may change it without regenerating the ID.
- Group changes should eventually be audited with old group, new group, actor, timestamp, and optional reason.
- Preserve the original name and normalized name used at issuance separately when the data model is extended; do not overwrite the real-world name with the dictionary's standard name.

## 9. Verification cases for the engine

1. Vietnamese accents and case differences match the same catalog alias.
2. A longer name containing a standard equipment name resolves to that dictionary entry.
3. An unknown name returns `not-found`; it does not fabricate a code or group.
4. Near-equal matches with different short codes return `ambiguous`.
5. An explicitly selected custom group takes precedence over the dictionary suggestion.
6. A missing selected group returns `missing-group`.
7. Plan A formats without a group code.
8. Plan B requires a group code.
9. Plan C/D require a valid commissioning date and a two-digit site code.
10. Sequence values expand beyond three digits without truncation.
11. Formatting and name edits never mutate an existing saved ID.
12. The engine never allocates an official sequence or persists data.

## 10. Database foundation applied to the Test project

Migration: `20261121070000_smart_equipment_id_engine_v1.sql`
Supabase migration history name: `smart_equipment_id_engine_v1`

Applied only to the `BAOTRI-Mini-Test` project. The production/inactive project and `BAOTRI-Mini-New` were not changed.

Database objects added:
- `public.organization_equipment_catalog`: one snapshot and Plan record per Organization. The Plan is not client-editable; snapshot reads are available to users who can view settings or create assets; snapshot updates require `settings.manage`.
- `private.asset_id_sequences`: private atomic sequence counters, inaccessible to browser roles.
- Six issuance metadata columns on `public.assets`: `original_name`, `normalized_name_at_creation`, `equipment_type_code`, `group_code_at_creation`, `site_code_at_creation`, `id_components_snapshot`.
- `public.guard_asset_identity_fields()` trigger: rejects UUID, Organization, equipment ID, and issuance-metadata changes; current group changes require `settings.manage`.
- `public.create_asset_with_smart_id(...)`: authenticated, permission-checked RPC that allocates the sequence and inserts the asset in one transaction.

The existing `public.create_asset_with_code` and `public.asset_code_counters` legacy generator were left intact.

### Sequence scopes now made explicit

- Plan A: Organization + equipment short code.
- Plan B: Organization + equipment short code + group code.
- Plan C/D: Organization + equipment short code + group code + site code.
- Plan C/D sequence does not reset each month; MMYY is a date segment, not a counter scope.
- Sequence display pads to at least three digits and never truncates values above 999.

Capacity is checked against all existing Organization assets, including archived records, before allocation. A per-Organization transaction advisory lock serializes capacity checks across equipment-code families.

### Test results (transactional; rolled back)

- Plan A: `BOM-001`
- Plan A after sequence 999: `BOM-1000`
- Plan B: `BOM-NUO-001`
- Plan C: `BOM-NUO-00-001-1126`
- Plan D: `BOM-NUO-01-001-1126`
- Admin can update current name and current group while the ID remains fixed.
- Attempted change of an existing equipment ID was rejected by the database trigger.

The test catalog rows and test equipment rows were inside explicit transactions and rolled back; no sample equipment or catalog snapshot was left in the Test Organization.

### Not yet provisioned / integrated

- The Test Organization currently has no row in `organization_equipment_catalog`. Its actual Plan must be provisioned by trusted platform operations; no Plan was guessed or assigned.
- The browser add-equipment form still uses the old manual-code path. It must be migrated to load the Organization snapshot, call the analyzer for suggestions, and invoke the new RPC on Cloud save.
- Local-first behavior needs a deliberate online/offline decision: official sequence allocation requires Cloud; a local preview must not be treated as an issued ID.
- Existing asset UUIDs are the `assets.id` primary keys. The current application uses those keys for relationships and Cloud operations. Hiding UUIDs from ordinary KTV/Viewer API responses requires a broader API/view refactor; this migration protects UUID immutability but does not yet hide the primary key from Data API responses.
- Admin-only group changes are enforced in the database trigger. The UI and Cloud mutation payload must be aligned so KTV edits can change names but not groups, while Admin can change groups with audit history.
