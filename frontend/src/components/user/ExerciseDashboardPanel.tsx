import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatLocalDateTimeMinute, parseApiDate } from '../../lib/datetime'
import {
  buildPoseReportPath,
  buildTrainingRecordName,
  getPoseExerciseByType,
  getPoseExercises,
  type PoseTrainingSession
} from '../../modules/pose'
import { buildMonthCells, formatYmdLocal, pad2, startOfMonth, startOfWeek } from '../../modules/user/profileDate'

const DAILY_SESSION_PAGE_SIZE = 3

function buildDailyPaginationItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)

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

function formatProfileDateTime(value: string) {
  return formatLocalDateTimeMinute(value)
}

type PoseSummary = {
  weekSessions: number
  weekReps: number
}

export type TrainingInsightsRange = 'day' | 'week' | 'month' | 'year'
type PoseStatsRange = TrainingInsightsRange

type PoseStatsPoint = {
  label: string
  sessions: number
  accuracyTotal: number
  accuracyCount: number
  exerciseCounts: Record<string, number>
}

type PoseExerciseStat = {
  type: string
  label: string
  count: number
  avgAccuracy: number | null
  share: number
  lastTrained: string | null
}

type PoseInsightData = {
  title: string
  periodLabel: string
  points: PoseStatsPoint[]
  totalReports: number
  avgAccuracy: number | null
  activeExercises: number
  exerciseStats: PoseExerciseStat[]
}

type ExerciseDashboardPanelProps = {
  poseHistoryError: string | null
  poseRecentLoading: boolean
  poseRecentTotal: number | null
  poseRecentSessions: PoseTrainingSession[]
  poseMonth: Date
  poseSelectedYmd: string
  poseSessions: PoseTrainingSession[]
  poseSessionsByDay: Map<string, PoseTrainingSession[]>
  poseLoading: boolean
  poseWeekLoading: boolean
  poseWeekError: string | null
  poseSummary: PoseSummary
  poseYearSessions: PoseTrainingSession[]
  poseYearLoading: boolean
  poseYearError: string | null
  latestPoseSession: PoseTrainingSession | null
  latestPoseExerciseName: string
  onReload: () => void
  onDeleteSession: (session: PoseTrainingSession) => Promise<void>
  onMonthChange: (next: Date) => void
  onSelectedYmdChange: (next: string) => void
}

export function ExerciseDashboardPanel(props: ExerciseDashboardPanelProps) {
  const [poseInsightNotice, setPoseInsightNotice] = useState<string | null>(null)
  const {
    poseHistoryError,
    poseRecentLoading,
    poseRecentTotal,
    poseRecentSessions,
    poseMonth,
    poseSelectedYmd,
    poseSessions,
    poseSessionsByDay,
    poseLoading,
    poseWeekLoading,
    poseWeekError,
    poseSummary,
    poseYearSessions,
    poseYearLoading,
    poseYearError,
    latestPoseSession,
    latestPoseExerciseName,
    onReload,
    onDeleteSession,
    onMonthChange,
    onSelectedYmdChange
  } = props

  return (
    <div className="space-y-4">
      {poseHistoryError ? (
        <div className="profile-panel">
          <div className="text-sm font-semibold">Pose</div>
          <div className="mt-2 text-sm text-rose-700">{poseHistoryError}</div>
          <button className="mt-3 profile-btn-secondary" onClick={onReload}>
            Retry
          </button>
        </div>
      ) : null}

      {poseRecentLoading || poseRecentTotal == null ? (
        <div className="profile-panel">
          <div className="text-sm text-slate-600">Loading pose dashboard...</div>
        </div>
      ) : poseRecentTotal === 0 ? (
        <div className="profile-panel">
          <div className="text-sm font-semibold">Start your first pose session</div>
          <div className="mt-2 text-sm text-slate-600">You have no pose training history yet.</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/tools/pose" className="profile-btn-primary">
              Analyze Video
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div id="training-insights">
            <TrainingInsightsPanel
              sessions={poseYearSessions}
              loading={poseWeekLoading || poseYearLoading}
              error={poseWeekError || poseYearError}
              latestPoseSession={latestPoseSession}
              latestPoseExerciseName={latestPoseExerciseName}
              onWindowNotice={setPoseInsightNotice}
            />
          </div>

          {poseInsightNotice ? <div className="profile-stats-window-notice">{poseInsightNotice}</div> : null}

          <PoseHistoryCalendar
            poseMonth={poseMonth}
            poseSelectedYmd={poseSelectedYmd}
            poseSessions={poseSessions}
            poseSessionsByDay={poseSessionsByDay}
            poseLoading={poseLoading}
            onMonthChange={onMonthChange}
            onSelectedYmdChange={onSelectedYmdChange}
            onDeleteSession={onDeleteSession}
          />

          <RecentPoseSessions sessions={poseRecentSessions} onReload={onReload} onDeleteSession={onDeleteSession} />
        </>
      )}
    </div>
  )
}

export function TrainingInsightsPanel(props: {
  sessions: PoseTrainingSession[]
  loading: boolean
  error: string | null
  latestPoseSession?: PoseTrainingSession | null
  latestPoseExerciseName?: string
  onWindowNotice?: (message: string | null) => void
  fixedRange?: TrainingInsightsRange
  showRangeTabs?: boolean
  showWindowControls?: boolean
  showFooter?: boolean
  title?: string
}) {
  const [range, setRange] = useState<PoseStatsRange>('day')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const activeRange = props.fixedRange ?? range
  const showRangeTabs = props.showRangeTabs ?? true
  const showWindowControls = props.showWindowControls ?? true
  const showFooter = props.showFooter ?? true
  const chart = useMemo(() => buildPoseStats(props.sessions, activeRange, anchorDate), [props.sessions, activeRange, anchorDate])
  const maxReports = Math.max(1, ...chart.points.map((point) => point.sessions))
  const peakExercise = [...chart.exerciseStats].sort((a, b) => b.count - a.count)[0]
  const atCurrentWindow = isCurrentInsightWindow(activeRange, anchorDate)
  const atEarliestWindow = isEarliestInsightWindow(activeRange, anchorDate, props.sessions)

  function moveInsightWindow(direction: -1 | 1) {
    if (direction < 0 && atEarliestWindow) {
      props.onWindowNotice?.(props.sessions.length === 0 ? 'No training reports available yet.' : 'This is the earliest range with training data.')
      return
    }
    if (direction > 0 && atCurrentWindow) {
      props.onWindowNotice?.('You are already viewing the current range.')
      return
    }
    props.onWindowNotice?.(null)
    setAnchorDate((current) => shiftInsightWindow(activeRange, current, direction))
  }

  function resetInsightWindow() {
    props.onWindowNotice?.(null)
    setAnchorDate(new Date())
  }

  return (
    <div className="profile-panel profile-stats-panel">
      <div className={`profile-stats-head${!showRangeTabs && !showWindowControls ? ' profile-stats-head-simple' : ''}`}>
        <div>
          <div className="text-sm font-semibold">{props.title ?? 'Training Insights'}</div>
        </div>
        <div className="profile-stats-period-pill">{chart.periodLabel}</div>
        {showRangeTabs ? (
          <div className="profile-stats-range-tabs" aria-label="Pose summary range">
            {([
              ['day', 'Day'],
              ['week', 'Week'],
              ['month', 'Month'],
              ['year', 'Year']
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={activeRange === key ? 'is-active' : ''}
                onClick={() => {
                  setRange(key)
                  setAnchorDate(new Date())
                  props.onWindowNotice?.(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {showWindowControls ? (
          <div className="profile-stats-window-controls" aria-label="Training insight time window">
            <button type="button" className={atEarliestWindow ? 'is-soft-disabled' : ''} onClick={() => moveInsightWindow(-1)}>
              {'<'}
            </button>
            <button type="button" onClick={resetInsightWindow}>
              Current
            </button>
            <button type="button" className={atCurrentWindow ? 'is-soft-disabled' : ''} onClick={() => moveInsightWindow(1)}>
              {'>'}
            </button>
          </div>
        ) : null}
      </div>

      {props.error ? <div className="mt-3 text-xs text-rose-700">{props.error}</div> : null}

      <div className="profile-stats-summary-grid">
        <div className="profile-stat-chip">
          <span>Reports analyzed</span>
          <strong>{props.loading ? '...' : chart.totalReports}</strong>
        </div>
        <div className="profile-stat-chip">
          <span>Avg Accuracy</span>
          <strong>{props.loading ? '...' : chart.avgAccuracy != null ? `${chart.avgAccuracy}%` : '-'}</strong>
        </div>
        <div className="profile-stat-chip">
          <span>Active moves</span>
          <strong>{props.loading ? '...' : `${chart.activeExercises}/4`}</strong>
        </div>
      </div>

      <div className="profile-exercise-matrix" aria-label="Exercise performance by movement">
        {chart.exerciseStats.map((exercise, index) => {
          const statusTone =
            exercise.count === 0
              ? 'empty'
              : exercise.avgAccuracy == null
                ? 'neutral'
                : exercise.avgAccuracy >= 85
                  ? 'good'
                  : exercise.avgAccuracy >= 70
                    ? 'steady'
                    : 'attention'
          const status =
            statusTone === 'empty'
              ? 'No data yet'
              : statusTone === 'neutral'
                ? 'Tracked'
                : statusTone === 'good'
                  ? 'High accuracy'
                  : statusTone === 'steady'
                    ? 'Steady progress'
                    : 'Needs attention'
          return (
            <div className="profile-exercise-stat-card" key={exercise.type}>
              <div className="profile-exercise-stat-head">
                <span className={`profile-exercise-dot profile-exercise-dot-${index + 1}`} />
                <strong>{exercise.label}</strong>
              </div>
              <div className="profile-exercise-stat-main">
                <span>{exercise.count}</span>
                <small>reports</small>
              </div>
              <div className="profile-exercise-meter" aria-hidden="true">
                <span style={{ width: `${exercise.share}%` }} />
              </div>
              <div className="profile-exercise-stat-meta">
                <span>{exercise.avgAccuracy != null ? `${exercise.avgAccuracy}% Avg Accuracy` : 'No accuracy score'}</span>
                <span className={`profile-exercise-status profile-exercise-status-${statusTone}`}>{status}</span>
                <span>Last trained: {exercise.lastTrained ?? '-'}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="profile-stats-section-head">
        <div>
          <strong>{chart.title}</strong>
          <span>Bars show report volume. Labels show Avg Accuracy.</span>
        </div>
        <div>{peakExercise && peakExercise.count > 0 ? `Most trained: ${peakExercise.label}` : 'No training data'}</div>
      </div>

      <div className="profile-stats-chart" aria-label={`${chart.title} chart`}>
        {chart.points.map((point) => {
          const accuracy = point.accuracyCount > 0 ? Math.round(point.accuracyTotal / point.accuracyCount) : 0
          const height = point.sessions === 0 ? 4 : Math.max(16, Math.round((point.sessions / maxReports) * 118))
          return (
            <div className="profile-stats-bar-item" key={point.label}>
              <div className="profile-stats-bar-track">
                <div
                  className="profile-stats-bar-fill"
                  style={{ height }}
                  title={`${point.label}: ${point.sessions} reports, ${accuracy || 0}% Avg Accuracy`}
                />
              </div>
              <div className="profile-stats-bar-label">{point.label}</div>
              <div className="profile-stats-bar-value">{point.sessions} reports</div>
              <div className="profile-stats-bar-subvalue">{point.sessions ? `${accuracy}% avg` : '-'}</div>
            </div>
          )
        })}
      </div>

      {showFooter ? (
        <div className="profile-stats-footer">
          <div>
            <span>Latest report</span>
            <strong>{props.latestPoseSession ? formatProfileDateTime(props.latestPoseSession.started_at) : '-'}</strong>
          </div>
          <div>
            <span>Latest exercise</span>
            <strong>{props.latestPoseSession ? props.latestPoseExerciseName : '-'}</strong>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function buildPoseStats(sessions: PoseTrainingSession[], range: PoseStatsRange, anchorDate: Date): PoseInsightData {
  const now = new Date(anchorDate)
  const decorate = (title: string, periodLabel: string, points: PoseStatsPoint[]) => {
    const included = sessions.filter((session) => isSessionInPoints(session, range, points, now))
    const accuracyValues = included.map(getSessionAccuracy).filter((value): value is number => value != null)
    const exerciseStats = buildExerciseStats(included)
    return {
      title,
      periodLabel,
      points,
      totalReports: included.length,
      avgAccuracy:
        accuracyValues.length > 0
          ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length)
          : null,
      activeExercises: exerciseStats.filter((exercise) => exercise.count > 0).length,
      exerciseStats
    }
  }

  if (range === 'day') {
    const points = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now)
      date.setDate(now.getDate() - (6 - index))
      return createPoseStatsPoint(formatInsightDayLabel(date), { key: formatYmdLocal(date) })
    })
    const byKey = new Map(points.map((point) => [point.key, point]))
    for (const session of sessions) {
      const date = parseApiDate(session.started_at)
      if (!date) continue
      const key = formatYmdLocal(date)
      const point = byKey.get(key)
      if (!point) continue
      addSessionToPoint(point, session)
    }
    const first = new Date(now)
    first.setDate(now.getDate() - 6)
    return decorate('Daily training trend', `${formatInsightDate(first)} - ${formatInsightDate(now)}, Last 7 days`, points)
  }

  if (range === 'week') {
    const points = Array.from({ length: 8 }, (_, index) => {
      const weekStart = startOfWeek(now)
      weekStart.setDate(weekStart.getDate() - (7 * (7 - index)))
      const key = formatYmdLocal(weekStart)
      return createPoseStatsPoint(formatInsightDate(weekStart), { key, start: weekStart })
    })
    for (const session of sessions) {
      const date = parseApiDate(session.started_at)
      if (!date) continue
      for (const point of points) {
        const start = point.start
        if (!(start instanceof Date)) continue
        const end = new Date(start)
        end.setDate(end.getDate() + 7)
        if (date >= start && date < end) {
          addSessionToPoint(point, session)
          break
        }
      }
    }
    const firstWeek = points[0]?.start instanceof Date ? points[0].start : now
    const lastWeek = startOfWeek(now)
    return decorate('Weekly training trend', `${formatInsightDate(firstWeek)} - ${formatInsightDate(lastWeek)}, Grouped by week`, points)
  }

  if (range === 'month') {
    const year = now.getFullYear()
    const points = Array.from({ length: 12 }, (_, month) =>
      createPoseStatsPoint(formatInsightMonthLabel(new Date(year, month, 1)), { month })
    )
    for (const session of sessions) {
      const date = parseApiDate(session.started_at)
      if (!date) continue
      if (date.getFullYear() !== year) continue
      const point = points[date.getMonth()]
      if (!point) continue
      addSessionToPoint(point, session)
    }
    return decorate('Monthly training trend', `${year} training, Grouped by month`, points)
  }

  const currentYear = now.getFullYear()
  const points = Array.from({ length: 5 }, (_, index) => {
    const year = currentYear - (4 - index)
    return createPoseStatsPoint(String(year), { year })
  })
  for (const session of sessions) {
    const date = parseApiDate(session.started_at)
    if (!date) continue
    const point = points.find((candidate) => candidate.year === date.getFullYear())
    if (!point) continue
    addSessionToPoint(point, session)
  }
  return decorate('Yearly training trend', `${currentYear - 4} - ${currentYear}, Grouped by year`, points)
}

function formatInsightDate(value: Date) {
  return value.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatInsightDayLabel(value: Date) {
  return value.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatInsightMonthLabel(value: Date) {
  return value.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function shiftInsightWindow(range: PoseStatsRange, current: Date, direction: -1 | 1) {
  const next = new Date(current)
  if (range === 'day') next.setDate(next.getDate() + direction * 7)
  if (range === 'week') next.setDate(next.getDate() + direction * 56)
  if (range === 'month') next.setFullYear(next.getFullYear() + direction)
  if (range === 'year') next.setFullYear(next.getFullYear() + direction * 5)
  const today = new Date()
  return next > today ? today : next
}

function isCurrentInsightWindow(range: PoseStatsRange, anchorDate: Date) {
  const today = new Date()
  if (range === 'day') return formatYmdLocal(anchorDate) >= formatYmdLocal(today)
  if (range === 'week') return startOfWeek(anchorDate).getTime() >= startOfWeek(today).getTime()
  if (range === 'month') {
    return anchorDate.getFullYear() > today.getFullYear() ||
      (anchorDate.getFullYear() === today.getFullYear() && anchorDate.getMonth() >= today.getMonth())
  }
  return anchorDate.getFullYear() >= today.getFullYear()
}

function isEarliestInsightWindow(range: PoseStatsRange, anchorDate: Date, sessions: PoseTrainingSession[]) {
  const earliest = getEarliestSessionDate(sessions)
  if (!earliest) return true
  if (range === 'day') {
    const windowStart = new Date(anchorDate)
    windowStart.setDate(windowStart.getDate() - 6)
    return formatYmdLocal(windowStart) <= formatYmdLocal(earliest)
  }
  if (range === 'week') {
    const windowStart = startOfWeek(anchorDate)
    windowStart.setDate(windowStart.getDate() - 7 * 7)
    return windowStart.getTime() <= startOfWeek(earliest).getTime()
  }
  if (range === 'month') return anchorDate.getFullYear() <= earliest.getFullYear()
  return anchorDate.getFullYear() - 4 <= earliest.getFullYear()
}

function getEarliestSessionDate(sessions: PoseTrainingSession[]) {
  let earliest: Date | null = null
  for (const session of sessions) {
    const date = parseApiDate(session.started_at)
    if (!date) continue
    if (!earliest || date < earliest) earliest = date
  }
  return earliest
}

function createPoseStatsPoint(label: string, extra: Record<string, unknown> = {}): PoseStatsPoint & Record<string, unknown> {
  return {
    label,
    sessions: 0,
    accuracyTotal: 0,
    accuracyCount: 0,
    exerciseCounts: {},
    ...extra
  }
}

function addSessionToPoint(point: PoseStatsPoint, session: PoseTrainingSession) {
  point.sessions += 1
  const exerciseType = session.sets[0]?.exercise_type ?? 'squat'
  point.exerciseCounts[exerciseType] = (point.exerciseCounts[exerciseType] ?? 0) + 1
  addAccuracy(point, session)
}

function addAccuracy(point: PoseStatsPoint, session: PoseTrainingSession) {
  const accuracy = getSessionAccuracy(session)
  if (accuracy == null) return
  point.accuracyTotal += accuracy
  point.accuracyCount += 1
}

function getSessionAccuracy(session: PoseTrainingSession) {
  const report = session.report
  if (!isRecord(report)) return null
  const keyMetrics = isRecord(report.keyMetrics) ? report.keyMetrics : null
  const raw =
    keyMetrics?.formAccuracyPct ??
    keyMetrics?.accuracyPct ??
    keyMetrics?.form_accuracy_pct ??
    report.formAccuracyPct ??
    report.accuracyPct
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, value))
}

function buildExerciseStats(sessions: PoseTrainingSession[]): PoseExerciseStat[] {
  const totalReports = Math.max(1, sessions.length)
  return getPoseExercises().map((exercise) => {
    const exerciseSessions = sessions.filter((session) => (session.sets[0]?.exercise_type ?? 'squat') === exercise.exerciseType)
    const accuracyValues = exerciseSessions.map(getSessionAccuracy).filter((value): value is number => value != null)
    const lastSession = [...exerciseSessions].sort((a, b) => (parseApiDate(b.started_at)?.getTime() ?? 0) - (parseApiDate(a.started_at)?.getTime() ?? 0))[0]
    return {
      type: exercise.exerciseType,
      label: exercise.displayName,
      count: exerciseSessions.length,
      avgAccuracy:
        accuracyValues.length > 0
          ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length)
          : null,
      share: Math.round((exerciseSessions.length / totalReports) * 100),
      lastTrained: lastSession ? formatShortProfileDate(lastSession.started_at) : null
    }
  })
}

function formatShortProfileDate(value: string) {
  const parsed = parseApiDate(value)
  if (!parsed) return value
  return formatLocalDateTimeMinute(value)
}

function isSessionInPoints(session: PoseTrainingSession, range: PoseStatsRange, points: Array<PoseStatsPoint & Record<string, unknown>>, now: Date) {
  const date = parseApiDate(session.started_at)
  if (!date) return false
  if (range === 'day') return points.some((point) => point.key === formatYmdLocal(date))
  if (range === 'week') {
    return points.some((point) => {
      const start = point.start
      if (!(start instanceof Date)) return false
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      return date >= start && date < end
    })
  }
  if (range === 'month') return date.getFullYear() === now.getFullYear()
  return points.some((point) => point.year === date.getFullYear())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function PoseHistoryCalendar(props: {
  poseMonth: Date
  poseSelectedYmd: string
  poseSessions: PoseTrainingSession[]
  poseSessionsByDay: Map<string, PoseTrainingSession[]>
  poseLoading: boolean
  onMonthChange: (next: Date) => void
  onSelectedYmdChange: (next: string) => void
  onDeleteSession: (session: PoseTrainingSession) => Promise<void>
}) {
  const { poseMonth, poseSelectedYmd, poseSessions, poseSessionsByDay, poseLoading, onMonthChange, onSelectedYmdChange, onDeleteSession } = props
  const [dailyPage, setDailyPage] = useState(1)
  const selectedSessions = useMemo(() => poseSessionsByDay.get(poseSelectedYmd) ?? [], [poseSelectedYmd, poseSessionsByDay])
  const dailyTotalPages = Math.max(1, Math.ceil(selectedSessions.length / DAILY_SESSION_PAGE_SIZE))
  const dailyPageSafe = Math.min(dailyPage, dailyTotalPages)
  const dailyPaginationItems = useMemo(() => buildDailyPaginationItems(dailyPageSafe, dailyTotalPages), [dailyPageSafe, dailyTotalPages])
  const visibleSelectedSessions = selectedSessions.slice((dailyPageSafe - 1) * DAILY_SESSION_PAGE_SIZE, dailyPageSafe * DAILY_SESSION_PAGE_SIZE)

  function selectDate(ymd: string) {
    const date = new Date(`${ymd}T00:00:00`)
    if (!Number.isNaN(date.getTime())) onMonthChange(new Date(date.getFullYear(), date.getMonth(), 1))
    onSelectedYmdChange(ymd)
    setDailyPage(1)
  }

  return (
    <div className="profile-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Pose History</div>
          <div className="mt-1 text-xs text-slate-600">Calendar view of your pose training sessions</div>
        </div>
        <Link to="/tools/pose/history" className="profile-btn-secondary">
          All History
        </Link>
      </div>

      <div className="mt-4 profile-history-main-grid">
        <div className="profile-subpanel">
          <div className="flex items-center justify-between">
            <button className="profile-btn-secondary" onClick={() => onMonthChange(new Date(poseMonth.getFullYear(), poseMonth.getMonth() - 1, 1))}>
              {'<'}
            </button>
            <div className="text-sm font-semibold">{poseMonth.toLocaleString('en-US', { year: 'numeric', month: 'long' })}</div>
            <button className="profile-btn-secondary" onClick={() => onMonthChange(new Date(poseMonth.getFullYear(), poseMonth.getMonth() + 1, 1))}>
              {'>'}
            </button>
          </div>

          <div className="mt-3 profile-date-picker-grid">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={poseSelectedYmd}
                onChange={(event) => selectDate(event.target.value)}
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-slate-600">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {buildMonthCells(poseMonth).map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} className="h-9" />
              const ymd = `${cell.year}-${pad2(cell.month + 1)}-${pad2(cell.day)}`
              const active = ymd === poseSelectedYmd
              const hasItems = poseSessionsByDay.has(ymd)
              return (
                <button
                  key={ymd}
                  className={[
                    'relative h-9 rounded-xl border text-sm transition',
                    active ? 'bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  ].join(' ')}
                  onClick={() => selectDate(ymd)}
                  style={active ? { borderColor: 'rgb(5 150 105)' } : undefined}
                >
                  {cell.day}
                  {hasItems ? (
                    <span
                      className={[
                        'absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
                        active ? 'bg-white' : 'bg-emerald-600'
                      ].join(' ')}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
              onClick={() => {
                const today = new Date()
                const todayYmd = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`
                onMonthChange(startOfMonth(today))
                onSelectedYmdChange(todayYmd)
                setDailyPage(1)
              }}
            >
              Today
            </button>
            {poseLoading ? <div>Loading...</div> : <div>Total reports this month: {poseSessions.length}</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{poseSelectedYmd}</div>
              <div className="mt-1 text-xs text-slate-600">
                Reports on selected date: {selectedSessions.length}
                {selectedSessions.length > DAILY_SESSION_PAGE_SIZE ? ` / showing ${visibleSelectedSessions.length} per page` : ''}
              </div>
            </div>
          </div>

          <div className="mt-4 profile-daily-session-list">
            {visibleSelectedSessions.map((s) => (
              <PoseSessionCard key={s.id} session={s} onDeleteSession={onDeleteSession} />
            ))}

            {selectedSessions.length === 0 && !poseLoading ? (
              <div className="text-sm text-slate-600">No sessions on this day</div>
            ) : null}
          </div>

          {selectedSessions.length > DAILY_SESSION_PAGE_SIZE ? (
            <div className="profile-daily-pagination">
              <button type="button" disabled={dailyPageSafe <= 1} onClick={() => setDailyPage(1)}>
                First
              </button>
              <button type="button" disabled={dailyPageSafe <= 1} onClick={() => setDailyPage((page) => Math.max(1, page - 1))}>
                Prev
              </button>
              <div className="profile-page-numbers" aria-label="Daily pose session pages">
                {dailyPaginationItems.map((item, index) =>
                  item === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="profile-page-ellipsis">...</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={item === dailyPageSafe ? 'is-active' : ''}
                      aria-current={item === dailyPageSafe ? 'page' : undefined}
                      onClick={() => setDailyPage(item)}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
              <button type="button" disabled={dailyPageSafe >= dailyTotalPages} onClick={() => setDailyPage((page) => Math.min(dailyTotalPages, page + 1))}>
                Next
              </button>
              <button type="button" disabled={dailyPageSafe >= dailyTotalPages} onClick={() => setDailyPage(dailyTotalPages)}>
                Last
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function RecentPoseSessions(props: { sessions: PoseTrainingSession[]; onReload: () => void; onDeleteSession: (session: PoseTrainingSession) => Promise<void> }) {
  return (
    <div className="profile-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Recent Pose Sessions</div>
          <div className="mt-1 text-xs text-slate-600">Most recent 5 sessions</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="profile-btn-secondary" onClick={props.onReload}>
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {props.sessions.slice(0, 5).map((s) => (
          <PoseSessionCard key={s.id} session={s} onDeleteSession={props.onDeleteSession} />
        ))}
      </div>
    </div>
  )
}

function PoseSessionCard(props: { session: PoseTrainingSession; onDeleteSession: (session: PoseTrainingSession) => Promise<void> }) {
  const s = props.session
  const totalReps = s.sets.reduce((acc, item) => acc + (item.reps ?? 0), 0)
  const exerciseType = s.sets[0]?.exercise_type ?? 'squat'
  const exercise = getPoseExerciseByType(exerciseType)
  const recordName =
    s.note?.trim() ||
    buildTrainingRecordName({
      startedAt: s.started_at,
      exerciseName: exercise.displayName
    })

  return (
    <div className="profile-subpanel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{recordName}</div>
          <div className="mt-1 text-xs text-slate-600">{formatProfileDateTime(s.started_at)}</div>
          <div className="mt-2 text-xs text-slate-600">{totalReps} reps</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={buildPoseReportPath(exercise.slug, s.id)} className="profile-btn-secondary">
            View Report
          </Link>
          <button type="button" className="profile-btn-chip-danger" onClick={() => props.onDeleteSession(s).catch(() => {})}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
