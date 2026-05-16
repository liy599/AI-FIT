import type { PoseAnalyzerFeedback } from '../analyzer/types'

export function collectFrameIssueMessages(feedback: PoseAnalyzerFeedback | null) {
  if (!feedback) return []
  const raw = [...(feedback.issues?.map((x) => x.message) ?? []), ...(feedback.warnings ?? [])]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const text = item.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    deduped.push(text)
  }
  return deduped
}

