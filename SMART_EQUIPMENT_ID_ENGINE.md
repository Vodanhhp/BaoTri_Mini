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

Cloud must not generate the final equipment ID or create the Local asset. When online, Cloud atomically reserves only the next numeric sequence for the Organization. Local formats the complete ID, writes the asset and its UUID to IndexedDB first, then confirms the reservation. If Local save fails, release the unused reservation; the numeric sequence is never reused. If confirmation fails after Local save, retain the Local record and retry confirmation later.

Counter scopes are now explicit: Plan A = Organization + equipment code; Plan B = Organization + equipment code + group code; Plan C/D = Organization + equipment code + group code + site code. For Plan C/D, MMYY is a code segment and does not reset the sequence.

## 6. Catalog snapshot isolation

The engine receives catalog data from its caller. For an existing Organization, the caller must supply that Organization's own snapshot plus its custom additions. It must not fetch the latest standard JSON as a live fallback.

The standard JSON is only an initialization source for a new Organization snapshot.

## 7. Integration prerequisites found in the current application

The current application is not yet ready for full end-to-end ID generation:

1. The Plan is stored with the Organization catalog snapshot, but the current application has no trusted provisioning flow to assign it.
2. The database snapshot table exists, but no organization currently has an initialized snapshot and the browser has no snapshot reader yet.
3. The add-equipment form still asks the user to type `Asset.code` manually.
4. Equipment groups in the form are still a static hard-coded list, not the Organization snapshot.
5. The Cloud edit-save path still preserves the previous `code` and `category`; it does not yet support the approved Admin group-change rule.
6. The database sequence reservation/confirmation RPCs exist, but the Local form does not call them yet.

Full integration requires tenant-isolated snapshot provisioning, organization Plan context, Local-first reservation/confirmation calls, local asset metadata, and changes to the existing Cloud import path. These must be implemented without weakening existing Local/Cloud locking and sync guarantees.

## 8. Immutable identity and editable operational information

- `Asset.id` / UUID is stable for the asset lifetime.
- `Asset.code` / business ID is immutable after save.
- `Asset.name` is the editable real-world name and never regenerates the ID.
- `Asset.category` is the current group; Admin may change it without regenerating the ID.
- Group changes are recorded in a private audit table with old group, new group, actor and timestamp; a reason can be added when the UI supplies one.
- The database now stores original name, normalized name at creation, equipment type code, group/site code at creation and immutable ID-components snapshot. The Local model still needs to persist these fields.

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

Migrations applied only to `BAOTRI-Mini-Test`:
- `20261121091634_smart_equipment_id_engine_v1.sql`
- `20261121091818_smart_equipment_id_local_first_reservations.sql`
- `20261121091922_smart_equipment_id_audit_hardening.sql`
- `20261121092304_smart_equipment_id_cloud_mirror_metadata.sql`

The production/inactive project and `BAOTRI-Mini-New` were not changed.

Database objects:
- `public.organization_equipment_catalog`: one catalog snapshot and Plan per Organization. Snapshot reads are available to users who can view settings or create assets; updates require `settings.manage`. Plan assignment is not client-editable.
- `private.asset_id_sequences`: private atomic sequence counters, inaccessible to browser roles.
- `private.asset_id_sequence_reservations`: private idempotent reservations linking a numeric sequence to the Local UUID and final Local-generated equipment ID after confirmation.
- Six issuance metadata columns on `public.assets`: `original_name`, `normalized_name_at_creation`, `equipment_type_code`, `group_code_at_creation`, `site_code_at_creation`, `id_components_snapshot`.
- `public.guard_asset_identity_fields()`: rejects UUID, Organization, equipment ID and issuance-metadata changes; current group changes require `settings.manage`.
- `private.asset_group_change_history`: records old/current group, actor and timestamp when Admin changes a group. The reason field is reserved for a later UI input.

The existing `public.create_asset_with_code` and `public.asset_code_counters` legacy generator remain intact. The temporary Cloud-side `create_asset_with_smart_id` RPC was removed before any real data was created. The final design uses:
- `public.reserve_asset_id_sequence(...)`: Cloud reserves a number only; returns sequence components, not a completed equipment ID.
- `public.confirm_asset_id_sequence_reservation(...)`: Cloud confirms the final ID that Local already saved.
- `public.release_asset_id_sequence_reservation(...)`: releases an unused reservation; the number is never reused.
- `public.confirm_asset_id_sequence_reservation(...)` now records the Local original/normalized name, equipment type code and immutable components snapshot.
- A Cloud insert trigger copies the confirmed Local metadata into `assets` during the existing `import_asset_preserving_identity` RPC. A Smart ID cannot be mirrored before its reservation is confirmed.

### Sequence scopes now explicit

- Plan A: Organization + equipment short code.
- Plan B: Organization + equipment short code + group code.
- Plan C/D: Organization + equipment short code + group code + site code.
- Plan C/D sequence does not reset each month; MMYY is a date segment, not a counter scope.
- Sequence display pads to at least three digits and never truncates values above 999.
- Capacity checks include existing assets and active reservations. A per-Organization transaction advisory lock serializes reservations across equipment-code families.

### Test results (all inside transactions and rolled back)

- Plan A reservation returns sequence 1; retrying the same reservation ID returns the same sequence.
- Plan A sequence 1000 is preserved as 1000 (not truncated to 100).
- Plan B returns sequence 1 for BOM/NUO.
- Plan C returns sequence 1 for BOM/NUO/site 00 and month-year 1126.
- Plan D returns sequence 1 for BOM/NUO/site 01 and month-year 1126.
- Confirmation accepted the Local-formatted examples: `BOM-001`, `BOM-1000`, `BOM-NUO-001`, `BOM-NUO-00-001-1126`, `BOM-NUO-01-001-1126`.
- End-to-end transactional test: Local reserved and confirmed `BOM-001`, then the existing Cloud import RPC mirrored the asset. The Cloud insert trigger populated original name, normalized name, equipment type code and reservation-linked component snapshot. The transaction was rolled back; no test asset or reservation remained.
- Admin group change audit recorded old group, new group and Admin UUID.
- All test catalog rows, reservations, counters and temporary updates were rolled back. The Test Organization still has its original 2 assets and no catalog row/reservations/counters from these tests.

### Not yet provisioned / integrated

- The Test Organization currently has no row in `organization_equipment_catalog`. Its actual Plan must be provisioned by trusted platform operations; no Plan was guessed or assigned.
- The browser add-equipment form still uses the old manual-code path. It must load the Organization snapshot, call the analyzer, reserve a number, let Local format/save the complete ID, then confirm the reservation.
- Local Preview/offline behavior must not invent an official ID when no sequence reservation can be obtained.
- The Cloud import path must accept and verify a confirmed reservation for newly generated Local equipment, while preserving legacy import behavior for existing records.
- Existing asset UUIDs are the `assets.id` primary keys and remain internal relationship keys. The current application still returns them through ordinary asset reads; hiding them from KTV/Viewer API responses requires a broader API/view refactor. This migration protects UUID immutability but does not yet hide the primary key.
- Admin-only group changes are enforced by the database trigger and audited. The UI and Cloud mutation path must be aligned so KTV edits can change names but not groups, while Admin can change groups.
