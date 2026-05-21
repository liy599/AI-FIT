import type { PoseAnalysisReport } from '../../modules/pose/reporting'
import { humanizePoseReport, mapPoseFeedbackMessage, poseTierLabel } from '../../modules/pose/reporting'
import {
  TOP_ISSUE_TIME_DISPLAY,
  asRecord,
  buildDisplayMetricGroups,
  buildIssueMetaLine,
  buildRepQualityHighlight,
  buildTopIssueCards,
  formatClock,
  metricTip,
  pickMetricNumber,
  poseTierRank,
  prettyMetricName,
  resolveDisplayMetrics
} from './PoseReportModel'
import { PoseReportSummaryBlock } from './PoseReportSummary'
import { PoseReportTimeline } from './PoseReportTimeline'
import { isPoseDebugEnabled } from '../../modules/pose/debugFlags'
import { getPoseDebugServerUrl } from '../../modules/pose/debugFlags'


export function ReportVisualization(props: { report: PoseAnalysisReport }) {
  const debugMode = isPoseDebugEnabled()
  const debugUrl = debugMode ? getPoseDebugServerUrl() : null
  const dbg = (hypothesisId: string, msg: string, data: Record<string, unknown>) => {
    if (!debugUrl) return
    fetch(debugUrl, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'pose-analysis-blank-page',
        runId: 'pre-fix',
        hypothesisId,
        location: 'PoseToolWidgets.tsx',
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now()
      })
    }).catch(() => {})
  }
  const report = humanizePoseReport(props.report as never) as unknown as Record<string, unknown>
  const keyMetrics = resolveDisplayMetrics(report)
  const metricGroups = buildDisplayMetricGroups(keyMetrics)
  const totalReps = pickMetricNumber(keyMetrics.totalReps) ?? 0
  const issues = Array.isArray(report.issues) ? (report.issues as Array<Record<string, unknown>>) : []
  const suggestions = Array.isArray(report.suggestions) ? (report.suggestions as string[]) : []
  const details = asRecord(report.details)
  const timeline = details && Array.isArray(details.timelineSampled) ? details.timelineSampled : []
  const timelineSeries =
    details && Array.isArray(details.timelineSeries)
      ? details.timelineSeries
          .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
          .map((item) => ({
            key: String(item.key ?? '').trim(),
            label: typeof item.label === 'string' ? item.label : undefined
          }))
          .filter((item) => item.key.length > 0)
      : undefined
  const exercise = asRecord(report.exercise)
  const exerciseSlug = String(exercise?.id ?? '').toLowerCase() || 'squat'
  const repFindings = details && Array.isArray(details.repFindings) ? (details.repFindings as Array<Record<string, unknown>>) : []
  const repFindingsProblem = repFindings.filter((item) => String(item.result ?? 'invalid') !== 'correct')
  const repFindingsNotes = repFindings.filter((item) => String(item.result ?? 'invalid') === 'correct' && String(item.tier ?? '') === 'warning')
  const repFindingsNotable = repFindingsProblem
  const maxFindingCards = 6
  const hashSnapshot = (url: string) => `${url.length}:${url.slice(0, 96)}:${url.slice(-64)}`
  const pickFindingCards = () => {
    // #region debug-point B:key-issues-pick
    dbg('B', 'key-issues-pick:start', {
      repFindings: repFindings.length,
      notable: repFindingsNotable.length
    })
    // #endregion
    const candidates = repFindingsNotable
      .filter((item) => typeof item.snapshotDataUrl === 'string' && item.snapshotDataUrl.length > 0)
      .map((item, index) => {
        const repNo = typeof item.repNumber === 'number' ? item.repNumber : index + 1
        const result = String(item.result ?? 'invalid')
        const primaryIssue = String(item.primaryIssue ?? 'No detail')
        const tierRaw = typeof item.tier === 'string' ? item.tier : null
        const leadHuman = mapPoseFeedbackMessage({ exerciseSlug, message: primaryIssue })
        const tier =
          tierRaw === 'gate' || tierRaw === 'warning' || tierRaw === 'issue' || tierRaw === 'rep_fail'
            ? tierRaw
            : result === 'incorrect'
              ? 'rep_fail'
              : result === 'invalid'
                ? 'gate'
                : leadHuman.tier
        const lead = leadHuman.label
        const tMs = pickMetricNumber(item.tMs)
        const snapshotDataUrl = item.snapshotDataUrl as string
        const snapTms = pickMetricNumber(item.snapshotBaseTms, item.snapshotTms, item.tMs) ?? 0
        const snapKey = `t${Math.round(snapTms / 250)}:${hashSnapshot(snapshotDataUrl)}`
        return { item, repNo, tier, lead, tMs, snapKey, rank: poseTierRank(tier) }
      })
      .sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank
        const ta = a.tMs ?? Number.POSITIVE_INFINITY
        const tb = b.tMs ?? Number.POSITIVE_INFINITY
        if (ta !== tb) return ta - tb
        return a.repNo - b.repNo
      })

    const picked: Array<Record<string, unknown>> = []
    const usedSnap = new Set<string>()
    const leadCounts = new Map<string, number>()
    const leadCount = (lead: string) => leadCounts.get(lead) ?? 0
    const addLead = (lead: string) => leadCounts.set(lead, (leadCounts.get(lead) ?? 0) + 1)

    for (const c of candidates) {
      if (picked.length >= maxFindingCards) break
      if (usedSnap.has(c.snapKey)) continue
      if (leadCount(c.lead) > 0) continue
      usedSnap.add(c.snapKey)
      addLead(c.lead)
      picked.push(c.item)
    }

    if (picked.length < maxFindingCards) {
      for (const c of candidates) {
        if (picked.length >= maxFindingCards) break
        if (usedSnap.has(c.snapKey)) continue
        if (leadCount(c.lead) >= (debugMode ? 2 : 1)) continue
        usedSnap.add(c.snapKey)
        addLead(c.lead)
        picked.push(c.item)
      }
    }

    if (picked.length < maxFindingCards) {
      const noteMax = 2
      let notePicked = 0
      const noteCandidates = repFindingsNotes
        .filter((item) => typeof item.snapshotDataUrl === 'string' && item.snapshotDataUrl.length > 0)
        .map((item, index) => {
          const repNo = typeof item.repNumber === 'number' ? item.repNumber : index + 1
          const primaryIssue = String(item.primaryIssue ?? 'No detail')
          const lead = mapPoseFeedbackMessage({ exerciseSlug, message: primaryIssue }).label
          const tMs = pickMetricNumber(item.tMs)
          const snapshotDataUrl = item.snapshotDataUrl as string
          const snapTms = pickMetricNumber(item.snapshotBaseTms, item.snapshotTms, item.tMs) ?? 0
          const snapKey = `n${Math.round(snapTms / 250)}:${hashSnapshot(snapshotDataUrl)}`
          return { item, repNo, lead, tMs, snapKey }
        })
        .sort((a, b) => {
          const ta = a.tMs ?? Number.POSITIVE_INFINITY
          const tb = b.tMs ?? Number.POSITIVE_INFINITY
          if (ta !== tb) return ta - tb
          return a.repNo - b.repNo
        })

      for (const c of noteCandidates) {
        if (picked.length >= maxFindingCards) break
        if (notePicked >= noteMax) break
        if (usedSnap.has(c.snapKey)) continue
        usedSnap.add(c.snapKey)
        picked.push(c.item)
        notePicked += 1
      }
    }

    if (picked.length < maxFindingCards) {
      const textOnlyMax = debugMode ? 2 : 1
      let textOnlyPicked = 0
      const textOnlyCandidates = repFindingsNotable
        .filter((item) => typeof item.snapshotDataUrl !== 'string' || item.snapshotDataUrl.length === 0)
        .map((item, index) => {
          const repNo = typeof item.repNumber === 'number' ? item.repNumber : index + 1
          const result = String(item.result ?? 'invalid')
          const primaryIssue = String(item.primaryIssue ?? 'No detail')
          const tierRaw = typeof item.tier === 'string' ? item.tier : null
          const leadHuman = mapPoseFeedbackMessage({ exerciseSlug, message: primaryIssue })
          const tier =
            tierRaw === 'gate' || tierRaw === 'warning' || tierRaw === 'issue' || tierRaw === 'rep_fail'
              ? tierRaw
              : result === 'incorrect'
                ? 'rep_fail'
                : result === 'invalid'
                  ? 'gate'
                  : leadHuman.tier
          if (tier !== 'warning' && tier !== 'gate') return null
          const lead = leadHuman.label
          const tMs = pickMetricNumber(item.tMs)
          return { item, repNo, lead, tMs }
        })
        .filter((x): x is { item: Record<string, unknown>; repNo: number; lead: string; tMs: number | null } => x !== null)
        .sort((a, b) => {
          const ta = a.tMs ?? Number.POSITIVE_INFINITY
          const tb = b.tMs ?? Number.POSITIVE_INFINITY
          if (ta !== tb) return ta - tb
          return a.repNo - b.repNo
        })

      for (const c of textOnlyCandidates) {
        if (picked.length >= maxFindingCards) break
        if (textOnlyPicked >= textOnlyMax) break
        if (leadCount(c.lead) > 0) continue
        addLead(c.lead)
        picked.push(c.item)
        textOnlyPicked += 1
      }
    }

    // #region debug-point B:key-issues-pick:end
    dbg('B', 'key-issues-pick:end', {
      picked: picked.length,
      uniqueSnap: usedSnap.size,
      uniqueLead: leadCounts.size
    })
    // #endregion

    return picked
  }
  const visualFindings = (() => {
    try {
      return pickFindingCards()
    } catch (e) {
      // #region debug-point A:key-issues-pick:crash
      dbg('A', 'key-issues-pick:crash', { message: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : null })
      // #endregion
      throw e
    }
  })()
  const visualTotal = repFindingsNotable.filter((item) => typeof item.snapshotDataUrl === 'string' && item.snapshotDataUrl.length > 0).length
  const keyIssueSummary = (() => {
    const groups = new Map<
      string,
      { lead: string; tier: 'gate' | 'warning' | 'issue' | 'rep_fail'; rank: number; count: number; firstTms: number | null; tags: string[] }
    >()
    for (const item of repFindingsNotable) {
      const primaryIssue = String(item.primaryIssue ?? 'No detail')
      const tierRaw = typeof item.tier === 'string' ? item.tier : null
      const result = String(item.result ?? 'invalid')
      const leadHuman = mapPoseFeedbackMessage({ exerciseSlug, message: primaryIssue })
      const tier =
        tierRaw === 'gate' || tierRaw === 'warning' || tierRaw === 'issue' || tierRaw === 'rep_fail'
          ? tierRaw
          : result === 'incorrect'
            ? 'rep_fail'
            : result === 'invalid'
              ? 'gate'
              : leadHuman.tier
      const lead = leadHuman.label
      const rank = poseTierRank(tier)
      const tMs = pickMetricNumber(item.tMs)
      const tags = Array.isArray(item.tags) ? item.tags.filter((x): x is string => typeof x === 'string') : []
      const prev = groups.get(lead)
      if (!prev) {
        groups.set(lead, { lead, tier, rank, count: 1, firstTms: tMs ?? null, tags })
        continue
      }
      prev.count += 1
      if (rank > prev.rank) {
        prev.rank = rank
        prev.tier = tier
      }
      if (prev.firstTms === null) prev.firstTms = tMs ?? null
      else if (tMs !== null && tMs !== undefined) prev.firstTms = Math.min(prev.firstTms, tMs)
      for (const tag of tags) {
        if (!prev.tags.includes(tag)) prev.tags.push(tag)
      }
    }
    return Array.from(groups.values())
      .sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank
        if (b.count !== a.count) return b.count - a.count
        const ta = a.firstTms ?? Number.POSITIVE_INFINITY
        const tb = b.firstTms ?? Number.POSITIVE_INFINITY
        return ta - tb
      })
      .slice(0, maxFindingCards)
  })()
  const incompleteIssueCount = repFindingsNotable.filter((item) => Array.isArray(item.tags) && item.tags.includes('Incomplete')).length
  const analyzerName = details && typeof details.analyzer === 'string' ? details.analyzer : null
  const showDiagnostics = debugMode
  const isBentOverRow = analyzerName === 'BentOverRowVideoAnalyzer' || exerciseSlug === 'bent-over-row'
  const isLateralRaise = analyzerName === 'LateralRaiseVideoAnalyzer' || exerciseSlug === 'lateral-raise'
  const isPushup = analyzerName === 'PushupVideoAnalyzer' || exerciseSlug === 'pushup'
  const isSquat = analyzerName === 'SquatVideoAnalyzer' || exerciseSlug === 'squat'
  const diagnosticsTitle =
    isBentOverRow
      ? 'Diagnostics (Bent-Over Row)'
      : isLateralRaise
        ? 'Diagnostics (Lateral Raise)'
        : isPushup
          ? 'Diagnostics (Pushup)'
          : isSquat
            ? 'Diagnostics (Squat)'
        : 'Diagnostics'
  const debug = showDiagnostics ? asRecord(details?.debug) : null
  const diagnostics = !showDiagnostics
    ? []
    : isBentOverRow
      ? [
        { key: 'trackingQuality', label: 'Tracking Quality', value: pickMetricNumber(details?.trackingQuality) },
        { key: 'frontAlignment', label: 'Front Alignment', value: pickMetricNumber(details?.frontAlignment) },
        { key: 'torsoAngle', label: 'Torso Angle', value: pickMetricNumber(details?.torsoAngle) },
        { key: 'elbowAngle', label: 'Elbow Angle', value: pickMetricNumber(details?.elbowAngle) },
        { key: 'rowDeg', label: 'Row Angle', value: pickMetricNumber(details?.rowDeg) },
        { key: 'symmetryGap', label: 'Symmetry Gap', value: pickMetricNumber(details?.symmetryGap) },
        { key: 'kneeAngleDeg', label: 'Knee Angle', value: pickMetricNumber(debug?.kneeAngleDeg) },
        { key: 'repMaxKneeAngle', label: 'Rep Max Knee Angle', value: pickMetricNumber(debug?.repMaxKneeAngle) },
        { key: 'repKneeHardFrames', label: 'Rep Knee Hard Frames', value: pickMetricNumber(debug?.repKneeHardFrames) },
        { key: 'repKneeSampleFrames', label: 'Rep Knee Samples', value: pickMetricNumber(debug?.repKneeSampleFrames) },
        { key: 'lastCompletedRepMaxKneeAngle', label: 'Last Rep Max Knee', value: pickMetricNumber(debug?.lastCompletedRepMaxKneeAngle) },
        { key: 'lastCompletedRepKneeHardFrames', label: 'Last Rep Knee Hard', value: pickMetricNumber(debug?.lastCompletedRepKneeHardFrames) },
        { key: 'lastCompletedRepKneeSampleFrames', label: 'Last Rep Knee Samples', value: pickMetricNumber(debug?.lastCompletedRepKneeSampleFrames) },
        { key: 'lastCompletedRepFrontViewFrames', label: 'Last Rep Front Frames', value: pickMetricNumber(debug?.lastCompletedRepFrontViewFrames) },
        { key: 'lastCompletedRepSideViewFrames', label: 'Last Rep Side Frames', value: pickMetricNumber(debug?.lastCompletedRepSideViewFrames) },
        { key: 'lastCompletedRepAlignmentSamples', label: 'Last Rep Align Samples', value: pickMetricNumber(debug?.lastCompletedRepAlignmentSamples) },
        { key: 'repCount', label: 'Raw Rep Count', value: pickMetricNumber(details?.repCount) },
        { key: 'lastRepFrameCount', label: 'Last Rep Frames', value: pickMetricNumber(details?.lastRepFrameCount) },
        { key: 'lastRepResult', label: 'Last Rep Result', value: typeof details?.lastRepResult === 'string' ? details?.lastRepResult : null },
        { key: 'lastRepMessage', label: 'Last Rep Message', value: typeof details?.lastRepMessage === 'string' ? details?.lastRepMessage : null },
        {
          key: 'lastRepReasons',
          label: 'Last Rep Reasons',
          value: Array.isArray(details?.lastRepReasonLabels) ? (details?.lastRepReasonLabels as unknown[]).filter((x) => typeof x === 'string').join('; ') : null
        },
        { key: 'modelName', label: 'Model', value: typeof details?.modelName === 'string' ? details?.modelName : null },
        {
          key: 'overlayTone',
          label: 'Overlay Tone (OK/Warn/Bad)',
          value: (() => {
            const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, number> | undefined
            if (!s) return null
            return `${s.ok}/${s.warn}/${s.bad} (${s.okPct}% green)`
          })()
        },
        {
          key: 'overlayBadSrc',
          label: 'Top Bad Overlay Hint',
          value: (() => {
            const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
            return typeof s?.topBad === 'string' ? s.topBad : null
          })()
        },
        {
          key: 'overlayWarnSrc',
          label: 'Top Warn Overlay Hint',
          value: (() => {
            const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
            return typeof s?.topWarn === 'string' ? s.topWarn : null
          })()
        }
      ]
      : isLateralRaise
        ? [
          { key: 'trackingQuality', label: 'Tracking Quality', value: pickMetricNumber(details?.trackingQuality) },
          { key: 'frontAlignment', label: 'Front Alignment', value: pickMetricNumber(details?.frontAlignment) },
          { key: 'torsoAngle', label: 'Torso Angle', value: pickMetricNumber(details?.torsoAngle) },
          { key: 'elbowAngle', label: 'Elbow Angle', value: pickMetricNumber(details?.elbowAngle) },
          { key: 'raiseDeg', label: 'Raise Angle', value: pickMetricNumber(details?.raiseDeg) },
          { key: 'symmetryGap', label: 'Symmetry Gap', value: pickMetricNumber(details?.symmetryGap) },
          { key: 'leftRaiseDeg', label: 'Left Raise', value: pickMetricNumber(debug?.leftRaiseDeg) },
          { key: 'rightRaiseDeg', label: 'Right Raise', value: pickMetricNumber(debug?.rightRaiseDeg) },
          { key: 'repMaxRaiseDeg', label: 'Rep Max Raise', value: pickMetricNumber(debug?.repMaxRaiseDeg) },
          { key: 'repPeakTorsoAngleDeg', label: 'Rep Peak Torso', value: pickMetricNumber(debug?.repPeakTorsoAngleDeg) },
          { key: 'repTorsoHardFrames', label: 'Rep Torso Hard Frames', value: pickMetricNumber(debug?.repTorsoHardFrames) },
          { key: 'repPeakSymmetryGapDeg', label: 'Rep Peak Symmetry', value: pickMetricNumber(debug?.repPeakSymmetryGapDeg) },
          { key: 'repSymmetryHardFrames', label: 'Rep Symmetry Hard Frames', value: pickMetricNumber(debug?.repSymmetryHardFrames) },
          { key: 'repMinElbowAngleDeg', label: 'Rep Min Elbow', value: pickMetricNumber(debug?.repMinElbowAngleDeg) },
          { key: 'repElbowHardFrames', label: 'Rep Elbow Hard Frames', value: pickMetricNumber(debug?.repElbowHardFrames) },
          { key: 'repFrontBadFrames', label: 'Rep Front-Bad Frames', value: pickMetricNumber(debug?.repFrontBadFrames) },
          { key: 'repValidFrameCount', label: 'Rep Valid Frames', value: pickMetricNumber(debug?.repValidFrameCount) },
          { key: 'repFrameCount', label: 'Rep Total Frames', value: pickMetricNumber(debug?.repFrameCount) },
          { key: 'lastCompletedRepMaxRaiseDeg', label: 'Last Rep Max Raise', value: pickMetricNumber(debug?.lastCompletedRepMaxRaiseDeg) },
          { key: 'lastCompletedRepTorsoHardFrames', label: 'Last Rep Torso Hard', value: pickMetricNumber(debug?.lastCompletedRepTorsoHardFrames) },
          { key: 'lastCompletedRepSymmetryHardFrames', label: 'Last Rep Symmetry Hard', value: pickMetricNumber(debug?.lastCompletedRepSymmetryHardFrames) },
          { key: 'lastCompletedRepElbowHardFrames', label: 'Last Rep Elbow Hard', value: pickMetricNumber(debug?.lastCompletedRepElbowHardFrames) },
          { key: 'lastCompletedRepFrontBadFrames', label: 'Last Rep Front-Bad', value: pickMetricNumber(debug?.lastCompletedRepFrontBadFrames) },
          { key: 'lastCompletedRepValidFrames', label: 'Last Rep Valid Frames', value: pickMetricNumber(debug?.lastCompletedRepValidFrames) },
          { key: 'lastCompletedRepFrames', label: 'Last Rep Total Frames', value: pickMetricNumber(debug?.lastCompletedRepFrames) },
          { key: 'repCount', label: 'Raw Rep Count', value: pickMetricNumber(details?.repCount) },
          { key: 'lastRepFrameCount', label: 'Last Rep Frames', value: pickMetricNumber(details?.lastRepFrameCount) },
          { key: 'lastRepResult', label: 'Last Rep Result', value: typeof details?.lastRepResult === 'string' ? details?.lastRepResult : null },
          { key: 'lastRepMessage', label: 'Last Rep Message', value: typeof details?.lastRepMessage === 'string' ? details?.lastRepMessage : null },
          {
            key: 'lastRepReasons',
            label: 'Last Rep Reasons',
            value: Array.isArray(details?.lastRepReasonLabels) ? (details?.lastRepReasonLabels as unknown[]).filter((x) => typeof x === 'string').join('; ') : null
          },
          { key: 'modelName', label: 'Model', value: typeof details?.modelName === 'string' ? details?.modelName : null },
          {
            key: 'overlayTone',
            label: 'Overlay Tone (OK/Warn/Bad)',
            value: (() => {
              const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, number> | undefined
              if (!s) return null
              return `${s.ok}/${s.warn}/${s.bad} (${s.okPct}% green)`
            })()
          },
          {
            key: 'overlayBadSrc',
            label: 'Top Bad Overlay Hint',
            value: (() => {
              const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
              return typeof s?.topBad === 'string' ? s.topBad : null
            })()
          },
          {
            key: 'overlayWarnSrc',
            label: 'Top Warn Overlay Hint',
            value: (() => {
              const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
              return typeof s?.topWarn === 'string' ? s.topWarn : null
            })()
          }
        ]
        : isPushup
          ? [
            { key: 'trackingQuality', label: 'Tracking Quality', value: pickMetricNumber(details?.trackingQuality) },
            { key: 'sideAlignment', label: 'Side Alignment', value: pickMetricNumber(details?.sideAlignment) },
            { key: 'torsoAngle', label: 'Torso Angle', value: pickMetricNumber(details?.torsoAngle) },
            { key: 'elbowAngle', label: 'Elbow Angle', value: pickMetricNumber(details?.elbowAngle) },
            { key: 'bodyLineAngle', label: 'Body Line Angle', value: pickMetricNumber(details?.bodyLineAngle) },
            { key: 'repMinElbowAngleDeg', label: 'Rep Min Elbow', value: pickMetricNumber(debug?.repMinElbowAngleDeg) },
            { key: 'repDepthGoodFrames', label: 'Rep Depth Frames', value: pickMetricNumber(debug?.repDepthGoodFrames) },
            { key: 'repReliableFrameCount', label: 'Rep Reliable Frames', value: pickMetricNumber(debug?.repReliableFrameCount) },
            { key: 'repSideViewHardFrames', label: 'Rep Side Hard Frames', value: pickMetricNumber(debug?.repSideViewHardFrames) },
            { key: 'repBodyLineHardFrames', label: 'Rep Body Hard Frames', value: pickMetricNumber(debug?.repBodyLineHardFrames) },
            { key: 'repHipSagHardFrames', label: 'Rep Hip Sag Frames', value: pickMetricNumber(debug?.repHipSagHardFrames) },
            { key: 'repHipPikeHardFrames', label: 'Rep Hip Pike Frames', value: pickMetricNumber(debug?.repHipPikeHardFrames) },
            { key: 'repLowConfidenceFrames', label: 'Rep LowConf Frames', value: pickMetricNumber(debug?.repLowConfidenceFrames) },
            { key: 'repFrameCount', label: 'Rep Total Frames', value: pickMetricNumber(debug?.repFrameCount) },
            { key: 'repCount', label: 'Raw Rep Count', value: pickMetricNumber(details?.repCount) },
            { key: 'lastRepFrameCount', label: 'Last Rep Frames', value: pickMetricNumber(details?.lastRepFrameCount) },
            { key: 'lastRepResult', label: 'Last Rep Result', value: typeof details?.lastRepResult === 'string' ? details?.lastRepResult : null },
            { key: 'lastRepMessage', label: 'Last Rep Message', value: typeof details?.lastRepMessage === 'string' ? details?.lastRepMessage : null },
            {
              key: 'lastRepReasons',
              label: 'Last Rep Reasons',
              value: Array.isArray(details?.lastRepReasonLabels) ? (details?.lastRepReasonLabels as unknown[]).filter((x) => typeof x === 'string').join('; ') : null
            },
            { key: 'modelName', label: 'Model', value: typeof details?.modelName === 'string' ? details?.modelName : null },
            {
              key: 'overlayTone',
              label: 'Overlay Tone (OK/Warn/Bad)',
              value: (() => {
                const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, number> | undefined
                if (!s) return null
                return `${s.ok}/${s.warn}/${s.bad} (${s.okPct}% green)`
              })()
            },
            {
              key: 'overlayBadSrc',
              label: 'Top Bad Overlay Hint',
              value: (() => {
                const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
                return typeof s?.topBad === 'string' ? s.topBad : null
              })()
            },
            {
              key: 'overlayWarnSrc',
              label: 'Top Warn Overlay Hint',
              value: (() => {
                const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
                return typeof s?.topWarn === 'string' ? s.topWarn : null
              })()
            }
          ]
          : isSquat
            ? [
              { key: 'trackingQuality', label: 'Tracking Quality', value: pickMetricNumber(details?.trackingQuality) },
              { key: 'frontAlignment', label: 'Front Alignment', value: pickMetricNumber(details?.offsetAngle) },
              { key: 'torsoAngle', label: 'Torso Angle', value: pickMetricNumber(details?.torsoAngle) },
              { key: 'hipAngle', label: 'Hip Angle', value: pickMetricNumber(details?.hipAngle) },
              { key: 'kneeAngle', label: 'Knee Angle', value: pickMetricNumber(details?.kneeAngle) },
              {
                key: 'repPeakKneeForwardRatio',
                label: 'Rep Peak Knee Ratio',
                value: pickMetricNumber(debug?.lastCompletedRepPeakKneeForwardRatio ?? debug?.repPeakKneeForwardRatio)
              },
              {
                key: 'repKneeForwardHardFrames',
                label: 'Rep Knee Hard Frames',
                value: pickMetricNumber(debug?.lastCompletedRepKneeForwardHardFrames ?? debug?.repKneeForwardHardFrames)
              },
              {
                key: 'repPeakTorsoLeanAngleDeg',
                label: 'Rep Peak Torso',
                value: pickMetricNumber(debug?.lastCompletedRepPeakTorsoLeanAngleDeg ?? debug?.repPeakTorsoLeanAngleDeg)
              },
              {
                key: 'repForwardLeanHardFrames',
                label: 'Rep Torso Hard Frames',
                value: pickMetricNumber(debug?.lastCompletedRepForwardLeanHardFrames ?? debug?.repForwardLeanHardFrames)
              },
              {
                key: 'repValidFrameCount',
                label: 'Rep Valid Frames',
                value: pickMetricNumber(debug?.lastCompletedRepValidFrameCount ?? debug?.repValidFrameCount)
              },
              {
                key: 'repSideViewBadFrames',
                label: 'Rep SideBad Frames',
                value: pickMetricNumber(debug?.lastCompletedRepSideViewBadFrames ?? debug?.repSideViewBadFrames)
              },
              {
                key: 'repFrameCount',
                label: 'Rep Total Frames',
                value: pickMetricNumber(debug?.lastCompletedRepFrameCount ?? debug?.repFrameCount)
              },
              { key: 'repCount', label: 'Raw Rep Count', value: pickMetricNumber(details?.repCount) },
              { key: 'lastRepFrameCount', label: 'Last Rep Frames', value: pickMetricNumber(details?.lastRepFrameCount) },
              { key: 'lastRepResult', label: 'Last Rep Result', value: typeof details?.lastRepResult === 'string' ? details?.lastRepResult : null },
              { key: 'lastRepMessage', label: 'Last Rep Message', value: typeof details?.lastRepMessage === 'string' ? details?.lastRepMessage : null },
              {
                key: 'lastRepReasons',
                label: 'Last Rep Reasons',
                value: Array.isArray(details?.lastRepReasonLabels) ? (details?.lastRepReasonLabels as unknown[]).filter((x) => typeof x === 'string').join('; ') : null
              },
              { key: 'modelName', label: 'Model', value: typeof details?.modelName === 'string' ? details?.modelName : null },
              {
                key: 'overlayTone',
                label: 'Overlay Tone (OK/Warn/Bad)',
                value: (() => {
                  const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, number> | undefined
                  if (!s) return null
                  return `${s.ok}/${s.warn}/${s.bad} (${s.okPct}% green)`
                })()
              },
              {
                key: 'overlayBadSrc',
                label: 'Top Bad Overlay Hint',
                value: (() => {
                  const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
                  return typeof s?.topBad === 'string' ? s.topBad : null
                })()
              },
              {
                key: 'overlayWarnSrc',
                label: 'Top Warn Overlay Hint',
                value: (() => {
                  const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
                  return typeof s?.topWarn === 'string' ? s.topWarn : null
                })()
              }
            ]
        : [
            { key: 'analyzer', label: 'Analyzer', value: analyzerName },
            { key: 'trackingQuality', label: 'Tracking Quality', value: pickMetricNumber(details?.trackingQuality) },
            { key: 'repCount', label: 'Raw Rep Count', value: pickMetricNumber(details?.repCount) },
            { key: 'modelName', label: 'Model', value: typeof details?.modelName === 'string' ? details?.modelName : null },
            {
              key: 'overlayTone',
              label: 'Overlay Tone (OK/Warn/Bad)',
              value: (() => {
                const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, number> | undefined
                if (!s) return null
                return `${s.ok}/${s.warn}/${s.bad} (${s.okPct}% green)`
              })()
            },
            {
              key: 'overlayBadSrc',
              label: 'Top Bad Overlay Hint',
              value: (() => {
                const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
                return typeof s?.topBad === 'string' ? s.topBad : null
              })()
            },
            {
              key: 'overlayWarnSrc',
              label: 'Top Warn Overlay Hint',
              value: (() => {
                const s = (details as Record<string, unknown> | null)?.overlayToneStats as Record<string, unknown> | undefined
                return typeof s?.topWarn === 'string' ? s.topWarn : null
              })()
            }
          ]
  const downloadReportJson = () => {
    const raw = props.report as unknown as Record<string, unknown>
    const task = typeof (raw as { task?: unknown }).task === 'object' && (raw as { task?: unknown }).task !== null ? ((raw as { task?: { id?: unknown } }).task?.id as unknown) : null
    const taskId = typeof task === 'string' && task.trim() ? task.trim() : 'pose-report'
    const blob = new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${taskId}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  const topIssueCards = buildTopIssueCards({
    issues,
    repFindings: repFindingsNotable,
    exerciseSlug,
    options: TOP_ISSUE_TIME_DISPLAY
  })

  return (
    <div className="pose-report-stack">
      <div className="pose-report-card pose-report-card-accent">
        <div className="pose-report-title">
          <span>Summary</span>
          {debugMode ? (
            <button type="button" className="pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn" onClick={downloadReportJson}>
              Download JSON
            </button>
          ) : null}
        </div>
        <PoseReportSummaryBlock summary={typeof report.summary === 'string' ? report.summary : ''} />
      </div>

      {(() => {
        const highlight = buildRepQualityHighlight({ repFindings: repFindingsProblem, exerciseSlug, keyMetrics, issues })
        return (
          <div className={`pose-report-card pose-report-highlight pose-report-highlight-${highlight.tone}`}>
            <div className="pose-report-title">Rep Quality Highlight</div>
            <div className="pose-report-highlight-body">
              <strong>{highlight.headline}</strong>
              <p>{highlight.copy}</p>
            </div>
          </div>
        )
      })()}

      <div className="pose-report-columns">
        <div className="pose-report-card pose-report-card-issues">
          <div className="pose-report-title">Top Issues</div>
          {topIssueCards.length === 0 ? (
            totalReps === 0 ? (
              <div className="pose-muted-copy">No reps detected yet. For best results: record from hip height, keep your full body visible, and use good front lighting.</div>
            ) : (
              <div className="pose-muted-copy">No obvious issues detected — your form looks consistent. Keep up the good work.</div>
            )
          ) : null}
          <div className="pose-report-issue-list">
            {topIssueCards.map((issue, index) => (
              <div key={index} className="pose-report-issue">
                <div className="pose-report-issue-head">
                  <strong>{issue.label}</strong>
                  <span className={`pose-tier-pill pose-tier-${issue.tier}`}>{poseTierLabel(issue.tier)}</span>
                </div>
                <span>{buildIssueMetaLine(issue)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pose-report-card pose-report-card-fixes">
          <div className="pose-report-title">What To Fix</div>
          {suggestions.length === 0 ? (
            totalReps === 0 ? (
              <div className="pose-muted-copy">No suggestions yet — the analyzer needs at least one complete rep to give targeted advice.</div>
            ) : (
              <div className="pose-muted-copy">No specific fixes flagged — your technique looks solid. Keep filming to track progress over time.</div>
            )
          ) : null}
          <ol className="pose-report-suggestions">
            {suggestions.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        </div>
      </div>

      {totalReps === 0 ? (
        <div className="pose-report-card pose-report-highlight pose-report-highlight-soft">
          <div className="pose-report-title">Snapshot Highlights</div>
          <div className="pose-report-highlight-body">
            <strong>No reps detected.</strong>
            <p>Try recording again with these tips: place the camera at hip height, keep 2-3 meters away, ensure your full body is visible, and use even front lighting. A side view works best for squats and push-ups.</p>
          </div>
        </div>
      ) : repFindings.length > 0 ? (
        repFindingsNotable.length > 0 ? (
          visualFindings.length > 0 ? (
            <div className="pose-report-card">
              <div className="pose-report-title">Snapshot Highlights</div>
              <div className="pose-report-issue-list">
                {visualFindings.map((item, index) => {
                  const repNo = typeof item.repNumber === 'number' ? item.repNumber : index + 1
                  const result = String(item.result ?? 'invalid')
                  const primaryIssue = String(item.primaryIssue ?? 'No detail')
                  const tags = Array.isArray(item.tags) ? item.tags.filter((x): x is string => typeof x === 'string') : []
                  const reasons = Array.isArray(item.reasons) ? item.reasons.filter((x): x is string => typeof x === 'string') : []
                  const tierRaw = typeof item.tier === 'string' ? item.tier : null
                  const tMs = pickMetricNumber(item.tMs)
                  const leadHuman = mapPoseFeedbackMessage({ exerciseSlug, message: primaryIssue })
                  const tier =
                    tierRaw === 'gate' || tierRaw === 'warning' || tierRaw === 'issue' || tierRaw === 'rep_fail'
                      ? tierRaw
                      : result === 'incorrect'
                        ? 'rep_fail'
                        : result === 'invalid'
                          ? 'gate'
                          : leadHuman.tier
                  const lead = leadHuman.label
                  const moreReasons = reasons
                    .map((reason) => mapPoseFeedbackMessage({ exerciseSlug, message: reason }).label)
                    .filter((reason, reasonIndex, all) => !!reason && all.indexOf(reason) === reasonIndex && reason !== lead)
                  const snapshotDataUrl = typeof item.snapshotDataUrl === 'string' ? item.snapshotDataUrl : null
                  return (
                    <div key={`${repNo}-${index}`} className="pose-report-finding">
                      <div className="pose-report-finding__thumb">
                        {snapshotDataUrl ? <img src={snapshotDataUrl} alt={`Rep ${repNo} snapshot`} loading="lazy" /> : <div className="pose-report-finding__thumb-placeholder" />}
                      </div>
                      <div className="pose-report-finding__body">
                        <div className="pose-report-issue-head">
                          <strong>{`Rep ${repNo}`}</strong>
                          <div>
                            <span className={`pose-tier-pill pose-tier-${tier}`}>{poseTierLabel(tier)}</span>
                            {tags.map((tag) => (
                              <span key={tag} className="pose-tier-pill pose-tier-gate">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span>{lead}</span>
                        {tMs !== null ? <span>{`Seen at ${formatClock(tMs)}`}</span> : null}
                        {debugMode && moreReasons.length > 0 ? <span>{`Also: ${moreReasons.join(', ')}`}</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="pose-report-card pose-report-highlight pose-report-highlight-soft">
              <div className="pose-report-title">Snapshot Highlights</div>
              <div className="pose-report-highlight-body">
                {repFindingsNotable.some((item) => String(item.result ?? 'invalid') !== 'correct') ? (
                  <>
                    <strong>Snapshots not available</strong>
                    <p>
                      {incompleteIssueCount > 0 && incompleteIssueCount >= Math.ceil(repFindingsNotable.length * 0.6)
                        ? 'Most reps were incomplete (range of motion too small), so snapshots may be limited. Try completing the full range and re-run for clearer key frames.'
                        : 'Issues were detected but frame snapshots could not be captured. Try re-running the analysis with a clearer video (more light and full body in frame).'}
                    </p>
                    {keyIssueSummary.length > 0 ? (
                      <div className="pose-report-issue-list">
                        {keyIssueSummary.map((s) => (
                          <div key={s.lead} className="pose-report-issue">
                            <div className="pose-report-issue-head">
                              <strong>{s.count > 1 ? `${s.lead} (×${s.count})` : s.lead}</strong>
                              <div>
                                <span className={`pose-tier-pill pose-tier-${s.tier}`}>{poseTierLabel(s.tier)}</span>
                                {s.tags.map((tag) => (
                                  <span key={tag} className="pose-tier-pill pose-tier-gate">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {s.firstTms !== null ? <span>{`Seen around ${formatClock(s.firstTms)}`}</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <strong>Nice work.</strong>
                    <p>All scored reps passed the form check with no issues. Keep the same technique and film again later to track your consistency.</p>
                  </>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="pose-report-card pose-report-highlight pose-report-highlight-good">
            <div className="pose-report-title">Snapshot Highlights</div>
            <div className="pose-report-highlight-body">
              <strong>Nice work.</strong>
              <p>All scored reps passed the form check with no issues. Keep the same technique and film again later to track your consistency.</p>
            </div>
          </div>
        )
      ) : null}

      {metricGroups.length > 0 ? (
        <div className="pose-report-card pose-report-card-metrics">
          <div className="pose-report-title">Key Metrics</div>
          <div className="pose-report-metrics-stack">
            {metricGroups.map((group) => (
              <div key={group.group} className="pose-report-metric-section">
                <div className="pose-report-metric-section-title">{group.group}</div>
                <div className="pose-report-metrics">
                  {group.items.map((item) => (
                    <div key={item.key} className="pose-report-card">
                      <div className="pose-report-label">{item.label}</div>
                      <div className="pose-report-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showDiagnostics ? (
        <div className="pose-report-card pose-report-card-soft">
          <div className="pose-report-title">{diagnosticsTitle}</div>
          <div className="pose-report-metrics">
            {diagnostics.map((item) => (
              <div key={item.key} className="pose-report-card">
                <div className="pose-report-label">{item.label}</div>
                <div className="pose-report-value">{item.value === null ? '-' : String(item.value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {debugMode && timeline.length > 0 ? <PoseReportTimeline timeline={timeline} series={timelineSeries} formatLabel={prettyMetricName} /> : null}

    </div>
  )
}
