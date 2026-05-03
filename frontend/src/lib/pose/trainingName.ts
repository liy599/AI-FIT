function pad2(v: number) {
  return String(v).padStart(2, '0')
}

function formatMinutePrecision(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const yyyy = d.getFullYear()
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mi = pad2(d.getMinutes())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

export function buildTrainingRecordName(input: { startedAt: string | Date; exerciseName: string }) {
  const ts = formatMinutePrecision(input.startedAt)
  const action = input.exerciseName.trim() || 'Training'
  return `${ts} ${action}`
}

