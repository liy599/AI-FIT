export function buildPaginationItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = new Set([1, total, current, current - 1, current + 1])
  if (current <= 3) {
    pages.add(2)
    pages.add(3)
    pages.add(4)
  }
  if (current >= total - 2) {
    pages.add(total - 1)
    pages.add(total - 2)
    pages.add(total - 3)
  }

  const sorted = [...pages].filter((item) => item >= 1 && item <= total).sort((a, b) => a - b)
  const result: Array<number | 'ellipsis'> = []
  for (const item of sorted) {
    const previous = result[result.length - 1]
    if (typeof previous === 'number' && item - previous > 1) result.push('ellipsis')
    result.push(item)
  }
  return result
}
