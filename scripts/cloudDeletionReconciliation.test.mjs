import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('Cloud tombstones preserve newer Local snapshots and turn outstanding mutations into conflicts', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  const helper = source.slice(source.indexOf('async function reconcileCloudDeletion'), source.indexOf('export async function importLocalAsset'))
  assert.match(helper, /local\.updatedAt!==link\.lastSyncedLocalUpdatedAt/)
  assert.match(helper, /m\.status==='pending'\|\|m\.status==='processing'\|\|m\.status==='conflict'/)
  assert.match(helper, /status:'conflict'/)
  assert.match(helper, /\{deletedAt,updatedAt:local\.updatedAt\}/)
  assert.match(helper, /lastSyncedLocalUpdatedAt:cloudUpdatedAt/)
  assert.match(source, /reconcileCloudDeletion\(organizationId,local,link,cloud\.deletedAt,cloud\.updatedAt\)/)
})

test('Deletion tombstones cannot soft-delete an unlinked or differently linked Local asset', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  const tombstones = source.slice(source.indexOf('for(const tombstone'), source.lastIndexOf('return summary'))
  assert.match(tombstones, /if\(!link\|\|link\.cloudCode!==tombstone\.code\)/)
  assert.match(tombstones, /summary\.protectedLocal\+\+/)
  assert.match(tombstones, /reconcileCloudDeletion\(organizationId,local,link,tombstone\.deleted_at,tombstone\.updated_at\)/)
})

test('Conflict resolution cannot select Local when the Cloud asset is already soft-deleted', async () => {
  const source = await read('../src/CloudAssetsPanel.tsx')
  assert.match(source, /if\(cloudAsset\.deletedAt\|\|\(Array\.isArray\(tombstones\)&&tombstones\.some\(\(row:Record<string,unknown>\)=>row\.code===local\.code\)\)\)throw new Error/)
  assert.match(source, /const cloudDeleted=Boolean\(cloudRecord\?\.deletedAt\|\|deletedCloudCodes\.includes\(asset\?\.code\?\?''\)\)/)
  assert.match(source, /client\.rpc\('list_cloud_asset_deletion_tombstones'/)
  assert.match(source, /cloudDeletionProfileAvailable/)
  assert.match(source, /\{!cloudDeleted&&<button className="primary-btn small".*Chọn Local/)
})


test('Cloud pagination stops if the backend repeats a next cursor', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  assert.equal((source.match(/const seenCursors=new Set<string>\(\)/g) || []).length, 2)
  assert.equal((source.match(/seenCursors\.has\(nextCursor\)/g) || []).length, 2)
  assert.match(source, /Cloud lặp cursor phân trang; dừng tải để tránh vòng lặp vô hạn/)
  assert.match(source, /Cloud lặp cursor phân trang; dừng đồng bộ để tránh vòng lặp vô hạn/)
})


test('pending Cloud mutations retry after initial sync or browser reconnect, with stale processing recovery', async () => {
  const source = await read('../src/App.tsx')
  assert.match(source, /retryCloudAssetMutation/)
  assert.match(source, /window\.addEventListener\('online',runSync\)/)
  assert.match(source, /m\.status==='pending'\|\|\(m\.status==='processing'&&Date\.now\(\)-new Date\(m\.updatedAt\)\.getTime\(\)>60000\)/)
  assert.match(source, /context\.permissions\.includes\('assets\.update'\)/)
  assert.match(source, /await syncCloudAssetsToLocal\(client,organizationId/)
})

 
test('Cloud retry refuses to send a stale Local snapshot and preserves its sync watermark', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  const retry = source.slice(source.indexOf('export async function retryCloudAssetMutation'))
  assert.match(retry, /local\.updatedAt!==mutation\.localUpdatedAt/)
  assert.match(retry, /link\.status==='conflict'\|\|local\.updatedAt!==mutation\.localUpdatedAt/)
  assert.match(retry, /status:'conflict'/)
  assert.match(retry, /lastSyncedLocalUpdatedAt:mutation\.localUpdatedAt/)
})

 
test('successful retry mirrors pending group-change history before marking it synced', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  const retry = source.slice(source.indexOf('export async function retryCloudAssetMutation'))
  assert.match(retry, /change\.syncStatus==='pending'&&change\.mutationId===mutationId/)
  assert.match(retry, /client\.rpc\('mirror_cloud_asset_group_change_history'/)
  assert.match(retry, /if\(historyError\)throw new Error/)
  assert.match(retry, /db\.assetGroupChanges\.update\(change\.id,\{syncStatus:'synced'\}\)/)
})

 
test('failed Cloud edits retain a Local audit event and mirror it only after mutation receipt is applied', async () => {
  const source = await read('../src/App.tsx')
  assert.match(source, /recordAssetHistory\(previous,value,undefined,undefined,mutationId,true\)/)
  assert.match(source, /const pendingHistory=await db\.assetHistory\.where\('organizationId'\)/)
  assert.match(source, /if\(mutation&&mutation\.status!=='applied'\)continue/)
  assert.match(source, /client\.rpc\('record_cloud_asset_history_event'/)
  assert.match(source, /db\.assetHistory\.update\(entry\.id,\{syncStatus:'synced'\}\)/)
})

 
test('failed soft-delete and archive operations retain audit events for later Cloud confirmation', async () => {
  const source = await read('../src/App.tsx')
  assert.match(source, /recordAssetHistory\(asset,candidate,'deleted','Admin đánh dấu xóa mềm thiết bị',mutationId,true\)/)
  assert.match(source, /if\(pendingCandidate&&pendingMutationId\)await recordAssetHistory\(asset,pendingCandidate,archived\?'archived':'restored'/)
  assert.match(source, /if\(mutation&&mutation\.status!=='applied'\)continue/)
})

 
test('online audit-history retry cannot bypass the mutation receipt gate', async () => {
  const source = await read('../src/App.tsx')
  const retry = source.slice(source.indexOf('const retry=async()=>{'), source.indexOf('const retry=async()=>{')+1500)
  assert.match(retry, /const mutation=await db\.assetMutations\.get\(entry\.id\)/)
  assert.match(retry, /if\(mutation&&mutation\.status!=='applied'\)continue/)
  assert.match(retry, /await syncAssetHistoryEntry\(entry\)/)
})

 
test('manual mutation retry mirrors its matching pending audit event after receipt confirmation', async () => {
  const source = await read('../src/CloudAssetsPanel.tsx')
  const retry = source.slice(source.indexOf('const retryOne='), source.indexOf('const resolveConflictCloud='))
  assert.match(retry, /await retryCloudAssetMutation\(client,organizationId,mutation\.mutationId\)/)
  assert.match(retry, /db\.assetHistory\.get\(mutation\.mutationId\)/)
  assert.match(retry, /client\.rpc\('record_cloud_asset_history_event'/)
  assert.match(retry, /db\.assetHistory\.update\(pendingHistory\.id,\{syncStatus:'synced'\}\)/)
})
 
test('both Cloud and Local conflict resolutions create an audit event, including no-field-change decisions', async () => {
  const panel = await read('../src/CloudAssetsPanel.tsx')
  const app = await read('../src/App.tsx')
  assert.match(panel, /onConflictResolved\(local,resolvedLocal,'Giải quyết xung đột: chọn Cloud làm phiên bản đúng\.'\)/)
  assert.match(panel, /onConflictResolved\(local,local,'Giải quyết xung đột: chọn Local làm phiên bản đúng\.',mutationId\)/)
  assert.match(app, /onConflictResolved=\{\(before,after,summary,eventId\)=>recordAssetHistory\(before,after,'updated',summary,eventId,false,true\)\}/)
  assert.match(app, /if \(before && !changes\.length && !force\) return/)
})

test('Cloud panel does not read Cloud data without assets.view and guards mutation handlers', async () => {
 const source = await read('../src/CloudAssetsPanel.tsx')
 const reload = source.slice(source.indexOf('const reload=async()=>{'), source.indexOf('useEffect(()=>{void reload()}'))
 assert.match(reload, /if\(!canView\)\{setPending\(\[\]\);setCloud\(\[\]\);setDeletedCloudCodes\(\[\]\);return\}/)
 assert.match(reload, /if\(!canView\)/)
 for (const name of ['retryOne','resolveConflictCloud','resolveConflictLocal','downloadOne']) {
  const start = source.indexOf('const '+name+'=async(')
  assert.notEqual(start,-1, name+' handler exists')
  assert.match(source.slice(start,start+280), /if\(!canView\|\|!canUpdate\)|if\(!canView\)/, name+' checks permission before work')
 }
 for (const name of ['importOne','importPreviewOne']) {
  const start = source.indexOf('const '+name+'=async(')
  assert.notEqual(start,-1, name+' handler exists')
  assert.match(source.slice(start,start+220), /if\(!canImport\)/, name+' checks import permission before work')
 }
 assert.match(source, /disabled=\{!canView\|\|!canUpdate\|\|!!busyId\} onClick=\{\(\)=>void resolveConflictCloud\(m\)\}/)
 assert.match(source, /disabled=\{!canView\|\|!canUpdate\|\|!!busyId\} onClick=\{\(\)=>void resolveConflictLocal\(m\)\}/)
})

test('asset cache is cleared and not loaded without assets.view or across organization switches', async () => {
 const source = await read('../src/App.tsx')
 const loader = source.slice(source.indexOf('const loadAssets = async'), source.indexOf('useEffect(()=>{\n    if(!session?.user.id||!organizationId||localPreview)', source.indexOf('const loadAssets = async')))
 assert.match(loader, /!organizationContexts\.find\(item=>item\.id===scope\)\?\.permissions\.includes\('assets\.view'\)/)
 assert.match(loader, /setAssets\(\[\]\)/)
 assert.match(loader, /let active=true/)
 assert.match(loader, /if\(active\)setAssets\(rows\)/)
 assert.match(loader, /return \(\)=>\{active=false\}/)
})

test('save and draft recovery recheck create/update grants at action time', async () => {
 const source = await read('../src/App.tsx')
 const save = source.slice(source.indexOf('const saveAsset = async'), source.indexOf('const addImages = async'))
 assert.match(save, /if\(previous&&!localPreview&&!canUpdate\)/)
 assert.match(save, /if\(!previous&&!localPreview&&!canCreate\)/)
 const resume = source.slice(source.indexOf('const resumeAssetDraft='), source.indexOf('const discardAssetDraft='))
 assert.match(resume, /if\(!localPreview&&!canCreate\)/)
 assert.match(source, /!showForm&&!localPreview&&canCreate&&recoverableDrafts\.length>0/)
})

test('automatic mutation retry requires an authorized Admin or KTV role as well as assets.update', async () => {
 const source = await read('../src/App.tsx')
 const sync = source.slice(source.indexOf('const runSync=async()=>{'), source.indexOf('const runSync=async()=>{')+2300)
 assert.match(sync, /const contextCanMutate=Boolean\(context\.isAdmin\|\|context\.roleCodes\.some\(code=>\['ktv','technician','maintenance_technician'\]/)
 assert.match(sync, /if\(contextCanMutate&&context\.permissions\.includes\('assets\.update'\)\)/)
})

test('automatic sync mirrors standalone pending history events but gates mutation-linked events on applied receipt', async () => {
 const source = await read('../src/App.tsx')
 const sync = source.slice(source.indexOf('const runSync=async()=>{'), source.indexOf('const runSync=async()=>{')+3200)
 assert.match(sync, /const mutation=await db\.assetMutations\.get\(entry\.id\)/)
 assert.match(sync, /if\(mutation&&mutation\.status!=='applied'\)continue/)
 assert.match(sync, /client\.rpc\('record_cloud_asset_history_event'/)
})

test('late Local asset reload cannot repopulate a previous organization scope', async () => {
 const source = await read('../src/App.tsx')
 const loader = source.slice(source.indexOf('const loadAssets = async'), source.indexOf('useEffect(() => {', source.indexOf('const loadAssets = async')))
 assert.match(loader, /const rows=await db\.assets\.where\('localScope'\)\.equals\(scope\)\.toArray\(\)/)
 assert.match(loader, /const activeScope=localPreview\?'local-preview':organizationId/)
 assert.match(loader, /if\(scope===activeScope&&\(localPreview\|\|organizationContexts\.find\(item=>item\.id===scope\)\?\.permissions\.includes\('assets\.view'\)\)\)setAssets\(rows\)/)
})

test('sign out clears cached tenant assets and sensitive modal state before another account signs in', async () => {
 const source = await read('../src/App.tsx')
 const signOut = source.slice(source.indexOf('const signOut = async'), source.indexOf('if (!sessionReady)', source.indexOf('const signOut = async')))
 for (const setter of ['setAssets([])','setLocalPreviewAssets([])','setDetailAsset(null)','setImageViewer(null)','setEditing(null)','setShowForm(false)','setCloudPanel(false)','setOrganizationContexts([])','setOrganizationId(\'\')']) assert.ok(signOut.includes(setter), 'missing '+setter)
})

test('organization deletion migration removes every RESTRICT dependency before deleting the tenant', async () => {
 const sql = await read('../supabase/migrations/20261123120236_fix_platform_delete_organization_dependencies.sql')
 const required = [
  'private.asset_group_change_history',
  'public.asset_activity_history',
  'public.assets',
  'private.asset_id_sequence_reservations',
  'private.asset_id_sequences',
  'public.organization_equipment_catalog',
  'private.organization_plan_change_history',
  'private.organization_plan_change_requests',
  'public.organization_members',
  'public.roles'
 ]
 const deletePositions = required.map(table => sql.indexOf('delete from '+table))
 for (let i=0;i<required.length;i++) assert.notEqual(deletePositions[i],-1,'missing cleanup for '+required[i])
 const tenantDelete=sql.indexOf('delete from public.organizations')
 assert.ok(tenantDelete>Math.max(...deletePositions),'tenant must be deleted after every dependent table')
 assert.match(sql,/security definer\s+set search_path = ''/)
 assert.match(sql,/revoke all on function private\.platform_delete_organization/)
})

test('organization lifecycle UI extracts the server error body from Supabase FunctionsHttpError', async () => {
 const source = await read('../src/PlatformAdminPanel.tsx')
 assert.match(source,/const functionErrorMessage=async\(error:unknown\)=>/)
 assert.match(source,/context instanceof Response/)
 assert.match(source,/payload\.error==='string'/)
 assert.match(source,/throw new Error\(await functionErrorMessage\(error\)\)/)
 const edge = await read('../supabase/functions/platform-manage-organization/index.ts')
 assert.match(edge,/detail\?\.code==='23503'\?409:400/)
 assert.match(edge,/response\(\{error:message,code:/)
})
