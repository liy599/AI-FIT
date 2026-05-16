import { Link } from 'react-router-dom'
import {
  buildPoseReportPath,
  buildTrainingRecordName,
  getPoseExerciseByType,
  type PoseTrainingSession
} from '../../modules/pose'
import { buildMonthCells, pad2, startOfMonth } from '../../modules/user/profileDate'

type PoseSummary = {
  weekSessions: number
  weekReps: number
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
  latestPoseSession: PoseTrainingSession | null
  latestPoseExerciseName: string
  onReload: () => void
  onMonthChange: (next: Date) => void
  onSelectedYmdChange: (next: string) => void
}

export function ExerciseDashboardPanel(props: ExerciseDashboardPanelProps) {
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
    latestPoseSession,
    latestPoseExerciseName,
    onReload,
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
          <PoseHistoryCalendar
            poseMonth={poseMonth}
            poseSelectedYmd={poseSelectedYmd}
            poseSessions={poseSessions}
            poseSessionsByDay={poseSessionsByDay}
            poseLoading={poseLoading}
            onMonthChange={onMonthChange}
            onSelectedYmdChange={onSelectedYmdChange}
          />

          <div className="profile-panel">
            <div className="text-sm font-semibold">Pose Summary</div>
            <div className="mt-1 text-xs text-slate-600">This week and your latest session</div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="profile-subpanel">
                <div className="text-xs text-slate-600">Sessions (week)</div>
                <div className="mt-2 text-2xl font-semibold">{poseWeekLoading ? '...' : poseSummary.weekSessions}</div>
                {poseWeekError ? <div className="mt-2 text-xs text-rose-700">{poseWeekError}</div> : null}
              </div>
              <div className="profile-subpanel">
                <div className="text-xs text-slate-600">Total reps (week)</div>
                <div className="mt-2 text-2xl font-semibold">{poseWeekLoading ? '...' : poseSummary.weekReps}</div>
              </div>
              <div className="profile-subpanel">
                <div className="text-xs text-slate-600">Latest session</div>
                <div className="mt-2 text-sm font-semibold">{latestPoseSession ? new Date(latestPoseSession.started_at).toLocaleString() : '-'}</div>
              </div>
              <div className="profile-subpanel">
                <div className="text-xs text-slate-600">Latest exercise</div>
                <div className="mt-2 text-sm font-semibold">{latestPoseSession ? latestPoseExerciseName : '-'}</div>
              </div>
            </div>
          </div>

          <RecentPoseSessions sessions={poseRecentSessions} onReload={onReload} />
        </>
      )}
    </div>
  )
}

function PoseHistoryCalendar(props: {
  poseMonth: Date
  poseSelectedYmd: string
  poseSessions: PoseTrainingSession[]
  poseSessionsByDay: Map<string, PoseTrainingSession[]>
  poseLoading: boolean
  onMonthChange: (next: Date) => void
  onSelectedYmdChange: (next: string) => void
}) {
  const { poseMonth, poseSelectedYmd, poseSessions, poseSessionsByDay, poseLoading, onMonthChange, onSelectedYmdChange } = props

  return (
    <div className="profile-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Pose History</div>
          <div className="mt-1 text-xs text-slate-600">Calendar view of your pose training sessions</div>
        </div>
      </div>

      <div className="mt-4 profile-history-main-grid">
        <div className="profile-subpanel">
          <div className="flex items-center justify-between">
            <button className="profile-btn-secondary" onClick={() => onMonthChange(new Date(poseMonth.getFullYear(), poseMonth.getMonth() - 1, 1))}>
              {'<'}
            </button>
            <div className="text-sm font-semibold">{poseMonth.toLocaleString(undefined, { year: 'numeric', month: 'long' })}</div>
            <button className="profile-btn-secondary" onClick={() => onMonthChange(new Date(poseMonth.getFullYear(), poseMonth.getMonth() + 1, 1))}>
              {'>'}
            </button>
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
                  onClick={() => onSelectedYmdChange(ymd)}
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
            <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50" onClick={() => onMonthChange(startOfMonth(new Date()))}>
              This month
            </button>
            {poseLoading ? <div>Loading...</div> : <div>{poseSessions.length} sessions</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{poseSelectedYmd}</div>
              <div className="mt-1 text-xs text-slate-600">{poseSessionsByDay.get(poseSelectedYmd)?.length ?? 0} sessions</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {(poseSessionsByDay.get(poseSelectedYmd) ?? []).map((s) => (
              <PoseSessionCard key={s.id} session={s} />
            ))}

            {(poseSessionsByDay.get(poseSelectedYmd) ?? []).length === 0 && !poseLoading ? (
              <div className="text-sm text-slate-600">No sessions on this day</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecentPoseSessions(props: { sessions: PoseTrainingSession[]; onReload: () => void }) {
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
          <PoseSessionCard key={s.id} session={s} />
        ))}
      </div>
    </div>
  )
}

function PoseSessionCard(props: { session: PoseTrainingSession }) {
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
          <div className="mt-1 text-xs text-slate-600">{new Date(s.started_at).toLocaleString()}</div>
          <div className="mt-2 text-xs text-slate-600">{totalReps} reps</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={buildPoseReportPath(exercise.slug, s.id)} className="profile-btn-secondary">
            View Report
          </Link>
        </div>
      </div>
    </div>
  )
}
