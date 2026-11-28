import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const appliedMigrationFiles = [
  "20261121022414_001_identity_and_organizations.sql",
  "20261121022440_005_roles_and_permissions.sql",
  "20261121022513_006_private_rbac_helpers.sql",
  "20261121022858_007_assets_import_permission_and_builtin_roles.sql",
  "20261121023532_008_cloud_asset_sync_and_locking.sql",
  "20261121024116_009_activate_invited_memberships_on_email_confirm.sql",
  "20261121024405_010_private_cloud_sync_rpc_wrappers.sql",
  "20261121045631_platform_organization_lifecycle.sql",
  "20261121094439_smart_equipment_id_engine_v1.sql",
  "20261121094441_smart_equipment_id_local_first_reservations.sql",
  "20261121094443_smart_equipment_id_audit_hardening.sql",
  "20261121094444_smart_equipment_id_cloud_mirror_metadata.sql",
  "20261121094447_smart_equipment_id_admin_confirmation.sql",
  "20261121094449_smart_equipment_id_admin_group_mutation.sql",
  "20261121094451_smart_equipment_id_local_group_audit_mirror.sql",
  "20261121094453_smart_equipment_id_catalog_snapshot_validation.sql",
  "20261121094809_smart_equipment_id_private_rpc_wrappers.sql",
  "20261121100426_platform_customer_plan_provisioning.sql",
  "20261121120907_platform_customer_provisioning_idempotency.sql",
  "20261121120954_grant_service_role_customer_provisioning_idempotency.sql",
  "20261122032223_cloud_asset_public_key_api.sql",
  "20261122034136_fix_customer_provisioning_service_role_claim.sql",
  "20261122034438_remove_unreliable_jwt_role_check_customer_provisioning.sql",
  "20261122034910_remove_unreliable_jwt_guard_inner_customer_provisioning.sql",
  "20261122055755_cloud_asset_sync_pagination_and_platform_read.sql",
  "20261122105818_organization_plan_change_workflow.sql",
  "20261122105819_serialize_smart_id_reservations_with_plan_changes.sql",
  "20261122105821_preserve_smart_id_reservation_retries_after_plan_change.sql",
  "20261122124403_add_cloud_asset_lock_anchor.sql",
  "20261122125135_fix_asset_mutation_receipt_actor_column.sql",
  "20261122133229_admin_soft_delete_assets.sql",
  "20261122141731_asset_activity_history.sql",
  "20261123105735_allow_stored_asset_status_in_cloud.sql",
  "20261123120236_fix_platform_delete_organization_dependencies.sql",
  "20261123132922_superadmin_organization_asset_reset.sql",
  "20261123135424_organization_asset_reset_approval_workflow.sql",
  "20261123140308_require_asset_reset_rejection_reason.sql",
  "20261123155243_asset_sync_change_feed.sql",
  "20261123155408_asset_sync_feed_index_cleanup.sql",
  "20261123155833_asset_sync_event_created_at.sql",
  "20261124010024_organization_equipment_catalog_audit.sql",
  "20261124030549_auto_local_asset_sync_permission.sql",
  "20261124042123_verify_cloud_asset_import_receipt.sql",
  "20261124042150_verify_cloud_asset_import_receipt_timestamp.sql",
  "20261124042230_move_import_receipt_verifier_private.sql",
  "20261124125830_inventory_local_cloud_sync.sql",
  "20261124130401_inventory_cloud_sync_hardening.sql",
  "20261124150248_reset_equipment_and_inventory.sql",
  "20261124153541_organization_name_change_requests.sql",
  "20261125115908_platform_superadmin_data_tools.sql",
  "20261126141059_selective_reset_scope_optional_checklist.sql",
  "20261126160654_fix_platform_delete_catalog_history_dependencies.sql"
]

const pendingMigrationFiles = [
  "20261126144630_checklist_cloud_online_foundation.sql",
  "20261126145323_checklist_phase1_admin_only.sql",
  "20261126150046_checklist_cloud_management_and_schedule_rpcs.sql",
  "20261126150054_checklist_public_rpc_wrappers.sql",
  "20261126150203_checklist_task_snapshot_metadata.sql",
  "20261126150642_checklist_definition_edit_reschedules_pending_tasks.sql",
  "20261126150723_checklist_cloud_cleans_disabled_future_occurrences.sql",
  "20261126150817_checklist_phase_one_admin_only_guards.sql",
  "20261126150853_checklist_result_validates_question_identity.sql",
  "20261126151227_checklist_definitions_write_only_through_versioned_rpc.sql",
  "20261126151244_checklist_cloud_minimum_table_privileges.sql",
  "20261126152057_checklist_equipment_requires_qr_task_flow.sql",
  "20261126152239_checklist_enforce_equipment_qr_and_immutable_task_snapshot.sql",
  "20261126152612_checklist_policy_and_fk_index_review.sql",
  "20261126152813_checklist_task_snapshot_target_identity.sql",
  "20261126153153_checklist_manual_run_idempotency.sql",
  "20261126153252_checklist_manual_run_idempotency_persist_run_id.sql",
  "20261126153530_checklist_claim_owner_null_safe_checks.sql",
  "20261126154308_checklist_definition_question_validation.sql",
  "20261126154410_checklist_equipment_target_must_be_active.sql",
  "20261126155414_checklist_template_soft_archive.sql",
  "20261126155613_checklist_block_editing_archived_templates.sql",
  "20261126162954_checklist_to_cloud_maintenance_requests.sql",
  "20261126163024_maintenance_request_cloud_rpcs.sql",
  "20261126163513_maintenance_schedule_cloud_rpcs.sql",
  "20261126163940_maintenance_cloud_fk_indexes.sql",
  "20261126164052_fix_maintenance_task_generated_id.sql",
  "20261126164407_platform_delete_maintenance_checklist_dependencies.sql",
  "20261126164557_guard_optional_tenant_cleanup_tables.sql",
  "20261126164618_fix_optional_cleanup_table_validation.sql",
  "20261126164704_expand_tenant_dependency_cleanup.sql",
  "20261126170029_harden_checklist_maintenance_request_creation.sql",
  "20261126170750_maintenance_legacy_local_import.sql",
  "20261126170844_preserve_legacy_maintenance_timestamps.sql",
  "20261127025051_maintenance_tasks_write_only_via_rpc.sql",
  "20261127025535_checklist_maintenance_fk_covering_indexes.sql",
  "20261127032548_checklist_preserve_archived_task_history.sql",
  "20261127032700_checklist_task_run_idempotency.sql",
  "20261127043000_grant_assets_select_to_authenticated.sql",
  "20261127050000_checklist_allow_manual_equipment_execution.sql",
  "20261127060000_maintenance_tasks_cloud_schema.sql",
  "20261127070000_checklist_non_equipment_maintenance_requests.sql",
  "20261127140000_fix_reset_checklist_cloud_dependencies.sql",
  "20261128120000_reset_maintenance_requests_scope.sql"
]

test('source migration inventory includes Production-applied history plus explicitly pending PR migrations', async () => {
  const files = (await readdir(new URL('../supabase/migrations/', import.meta.url)))
    .filter(file => file.endsWith('.sql'))
    .sort()
  const expected = [...appliedMigrationFiles,...pendingMigrationFiles].sort()
  const versionPrefixes = files.map(file => file.slice(0,14))

  assert.equal(new Set(versionPrefixes).size, versionPrefixes.length, 'migration version prefixes must be unique')
  assert.deepEqual(files, expected, 'source migration files must equal applied history plus explicitly pending PR migrations')
})


test('selective Reset can remove maintenance requests without deleting scheduled maintenance or Checklist history', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261128120000_reset_maintenance_requests_scope.sql', import.meta.url), 'utf8')
  const resetBlock = migration.slice(migration.indexOf('if v_req.reset_maintenance_requests then'), migration.indexOf('if v_req.reset_inventory then'))

  assert.match(migration, /reset_maintenance_requests boolean not null default false/)
  assert.match(resetBlock, /delete from public\\.maintenance_request_events/)
  assert.match(resetBlock, /delete from public\\.maintenance_requests/)
  assert.ok(resetBlock.indexOf('delete from public.maintenance_request_events') < resetBlock.indexOf('delete from public.maintenance_requests'))
  assert.match(resetBlock, /update public\\.checklist_runs set maintenance_request_id=null/)
  assert.doesNotMatch(resetBlock, /delete from public\\.maintenance_tasks/)
  assert.doesNotMatch(resetBlock, /delete from public\\.checklist_runs/)
})
