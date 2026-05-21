const OFFSET_PATTERN = /([zZ]|[+-]\d{2}:?\d{2})$/

function parseApiDateTime(value: string) {
  const text = (value || '').trim()
  if (!text) return null
  const normalized = text.includes('T') && !OFFSET_PATTERN.test(text) ? `${text}Z` : text
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function formatLocalDateTimeMinute(value: string) {
  const parsed = parseApiDateTime(value)
  if (!parsed) return value
  return [
    parsed.getFullYear(),
    '-',
    pad2(parsed.getMonth() + 1),
    '-',
    pad2(parsed.getDate()),
    ' ',
    pad2(parsed.getHours()),
    ':',
    pad2(parsed.getMinutes())
  ].join('')
}

export function formatLocalDate(value: string) {
  const parsed = parseApiDateTime(value)
  if (!parsed) return value
  return [parsed.getFullYear(), '-', pad2(parsed.getMonth() + 1), '-', pad2(parsed.getDate())].join('')
}

export function parseApiDate(value: string) {
  return parseApiDateTime(value)
}
