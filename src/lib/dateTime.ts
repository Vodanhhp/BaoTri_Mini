export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

type DateInput = string | number | Date | null | undefined

function asDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  // HTML date inputs and SQL DATE values are calendar dates, not UTC instants.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(value + 'T00:00:00+07:00')
    : value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateVN(value: DateInput, fallback = '—'): string {
  const date = asDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatDateTimeVN(value: DateInput, fallback = '—'): string {
  const date = asDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function todayVNDateInput(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
