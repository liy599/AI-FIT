export function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function formatYmdLocal(date: Date) {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function startOfWeek(date: Date) {
  const copy = new Date(date.getTime())
  const dayIndex = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - dayIndex)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function buildMonthCells(monthStart: Date) {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const mondayIndex = (new Date(year, month, 1).getDay() + 6) % 7
  const cells: Array<{ year: number; month: number; day: number } | null> = []
  for (let i = 0; i < mondayIndex; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ year, month, day })
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
