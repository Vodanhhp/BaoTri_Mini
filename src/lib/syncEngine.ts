/**
 * Application-level sync scheduler.
 *
 * It only schedules the existing authorized sync cycle; it does not perform
 * database writes itself. The caller remains responsible for tenant, role,
 * reset-generation, edit-lock and RPC authorization checks.
 */
export type SyncEngineOptions = {
  run: () => void | Promise<void>
  isActive?: () => boolean
  intervalMs?: number
}

const SYNC_REQUEST_EVENT = 'baotri:sync-request'

/** Request an immediate sync after a Local-first write has been committed. */
export function requestSync(): void {
  window.dispatchEvent(new Event(SYNC_REQUEST_EVENT))
}

export function startSyncEngine(options: SyncEngineOptions): () => void {
  let stopped = false
  let running = false
  const intervalMs = Math.max(15_000, options.intervalMs ?? 60_000)

  const execute = async () => {
    if (stopped || running || (options.isActive && !options.isActive())) return
    if (!navigator.onLine || document.visibilityState === 'hidden') return
    running = true
    try {
      await options.run()
    } finally {
      running = false
    }
  }

  const onOnline = () => { void execute() }
  const onRequest = () => { void execute() }
  const onFocus = () => { void execute() }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void execute()
  }

  window.addEventListener('online', onOnline)
  window.addEventListener(SYNC_REQUEST_EVENT, onRequest)
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisibilityChange)
  const timer = window.setInterval(() => { void execute() }, intervalMs)
  void execute()

  return () => {
    stopped = true
    window.clearInterval(timer)
    window.removeEventListener('online', onOnline)
    window.removeEventListener(SYNC_REQUEST_EVENT, onRequest)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
