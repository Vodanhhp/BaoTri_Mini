import { db, now, type ChecklistDefinition, type ChecklistFrequency, type ChecklistTask } from '../db'

const localDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const atExecutionTime = (date: Date, executionTime = '09:00') => {
  const value = new Date(date)
  const match = /^(\d{2}):(\d{2})$/.exec(executionTime)
  const hour = match ? Math.min(23, Number(match[1])) : 9
  const minute = match ? Math.min(59, Number(match[2])) : 0
  value.setHours(hour, minute, 0, 0)
  return value
}

const addMonthsClamped = (anchor: Date, monthOffset: number, executionTime: string) => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth() + monthOffset, 1)
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  first.setDate(Math.min(anchor.getDate(), lastDay))
  return atExecutionTime(first, executionTime)
}

const scheduledDates = (definition: ChecklistDefinition, end: Date): Date[] => {
  const anchor = new Date(definition.scheduleStartedAt || definition.createdAt)
  if (Number.isNaN(anchor.getTime())) return []
  const frequency: ChecklistFrequency = definition.frequency
  const executionTime = definition.executionTime || '09:00'
  const dates: Date[] = []
  const pushIfValid = (candidate: Date) => {
    if (candidate >= anchor && candidate <= end) dates.push(candidate)
  }

  if (frequency === 'Hàng ngày') {
    const first = atExecutionTime(anchor, executionTime)
    if (first < anchor) first.setDate(first.getDate() + 1)
    for (const cursor = new Date(first); cursor <= end; cursor.setDate(cursor.getDate() + 1)) dates.push(new Date(cursor))
  } else if (frequency === 'Hàng tuần') {
    let candidate = atExecutionTime(anchor, executionTime)
    if (candidate < anchor) candidate.setDate(candidate.getDate() + 7)
    for (; candidate <= end; candidate = new Date(candidate.getTime() + 7 * 86400000)) dates.push(new Date(candidate))
  } else if (frequency === 'Hàng tháng') {
    for (let offset = 0; offset <= 18; offset++) pushIfValid(addMonthsClamped(anchor, offset, executionTime))
  } else if (frequency === 'Hàng quý') {
    for (let offset = 0; offset <= 6; offset++) pushIfValid(addMonthsClamped(anchor, offset * 3, executionTime))
  } else if (frequency === 'Hàng năm') {
    for (let offset = 0; offset <= 2; offset++) {
      const candidate = new Date(anchor.getFullYear() + offset, anchor.getMonth(), 1)
      const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()
      candidate.setDate(Math.min(anchor.getDate(), lastDay))
      pushIfValid(atExecutionTime(candidate, executionTime))
    }
  }
  return dates
}

export async function ensureChecklistOccurrences(organizationId: string) {
  if (!organizationId) return
  const definitions = await db.checklistDefinitions.where('organizationId').equals(organizationId).toArray()
  const settings = await db.checklistCategorySettings.where('organizationId').equals(organizationId).toArray()
  const active = definitions.filter(item => item.enabled && item.frequency !== 'Linh hoạt' && (item.source !== 'starter' || settings.some(setting => setting.categoryKey === item.categoryKey && setting.enabled)))
  const activeIds = new Set(active.map(item => item.id))
  const current = new Date()
  const horizon = new Date(current.getFullYear() + 1, current.getMonth(), current.getDate(), 23, 59, 59, 999)
  const existing = await db.checklistTasks.where('organizationId').equals(organizationId).toArray()
  const currentById = new Map(active.map(item => [item.id, item]))
  const obsolete = existing.filter(task => task.status !== 'Hoàn thành' && new Date(task.dueAt).getTime() >= current.getTime() && (!activeIds.has(task.checklistId) || (currentById.has(task.checklistId) && (currentById.get(task.checklistId)!.frequency !== task.frequency || (currentById.get(task.checklistId)!.executionTime || '09:00') !== (task.executionTime || '09:00')))))
  if (obsolete.length) await db.checklistTasks.bulkDelete(obsolete.map(item => item.id))
  const retained = existing.filter(item => !obsolete.some(row => row.id === item.id))
  const known = new Set(retained.map(item => item.id))
  const additions: ChecklistTask[] = []

  for (const definition of active) {
    const executionTime = definition.executionTime || '09:00'
    for (const dueAt of scheduledDates(definition, horizon)) {
      const dueDate = localDateKey(dueAt)
      const id = `${definition.id}@${dueDate}`
      if (known.has(id)) continue
      additions.push({
        id, organizationId, checklistId: definition.id, title: definition.title,
        targetLabel: definition.targetLabel, frequency: definition.frequency,
        dueAt: dueAt.toISOString(), dueDate, executionTime, assignee: definition.assignee,
        status: dueAt.getTime() < current.getTime() ? 'Quá hạn' : 'Chờ thực hiện',
        definitionSnapshot: {
          categoryKey: definition.categoryKey,
          questions: definition.questions.map(question => ({ ...question }))
        },
        createdAt: now(), updatedAt: now()
      })
      known.add(id)
    }
  }

  if (additions.length) await db.checklistTasks.bulkAdd(additions)
  const unfinished = existing.filter(item => item.status !== 'Hoàn thành' && item.status !== 'Quá hạn' && new Date(item.dueAt).getTime() < current.getTime())
  if (unfinished.length) {
    await db.checklistTasks.bulkPut(unfinished.map(item => ({ ...item, status: 'Quá hạn' as const, updatedAt: now() })))
  }
}

export const checklistLocalDateKey = localDateKey
