import type { MealHistory } from '../../modules/user/profileTypes'
import { buildMonthCells, pad2, startOfMonth } from '../../modules/user/profileDate'

type DietHistoryPanelProps = {
  dietMonth: Date
  dietSelectedYmd: string
  dietMeals: MealHistory[]
  dietMealsByDay: Map<string, MealHistory[]>
  dietLoading: boolean
  dietError: string | null
  dietTotal: number | null
  onReload: () => void
  onMonthChange: (next: Date) => void
  onSelectedYmdChange: (next: string) => void
}

export function DietHistoryPanel(props: DietHistoryPanelProps) {
  const {
    dietMonth,
    dietSelectedYmd,
    dietMeals,
    dietMealsByDay,
    dietLoading,
    dietError,
    dietTotal,
    onReload,
    onMonthChange,
    onSelectedYmdChange
  } = props

  return (
    <div className="profile-panel">
      <div className="profile-history-head-row">
        <div>
          <div className="text-sm font-semibold">Diet History</div>
          <div className="mt-1 text-xs text-slate-600">Calendar view of your meal records</div>
        </div>
        <button className="profile-btn-secondary" onClick={onReload}>
          Refresh
        </button>
      </div>

      {dietError ? (
        <div className="mt-3">
          <div className="text-sm text-rose-700">{dietError}</div>
          <button className="mt-3 profile-btn-secondary" onClick={onReload}>
            Retry
          </button>
        </div>
      ) : null}

      {dietLoading ? <div className="mt-3 text-sm text-slate-600">Loading diet history...</div> : null}

      {dietTotal === 0 && !dietLoading && !dietError ? <div className="mt-4 text-sm text-slate-600">No diet records yet</div> : null}

      {!dietError && dietTotal !== 0 ? (
        <div className="mt-4 profile-history-main-grid">
          <div className="profile-subpanel">
            <div className="flex items-center justify-between">
              <button className="profile-btn-secondary" onClick={() => onMonthChange(new Date(dietMonth.getFullYear(), dietMonth.getMonth() - 1, 1))}>
                {'<'}
              </button>
              <div className="text-sm font-semibold">{dietMonth.toLocaleString(undefined, { year: 'numeric', month: 'long' })}</div>
              <button className="profile-btn-secondary" onClick={() => onMonthChange(new Date(dietMonth.getFullYear(), dietMonth.getMonth() + 1, 1))}>
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
              {buildMonthCells(dietMonth).map((cell, idx) => {
                if (!cell) return <div key={`diet-empty-${idx}`} className="h-9" />
                const ymd = `${cell.year}-${pad2(cell.month + 1)}-${pad2(cell.day)}`
                const active = ymd === dietSelectedYmd
                const hasItems = dietMealsByDay.has(ymd)
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
              {dietLoading ? <div>Loading...</div> : <div>{dietMeals.length} records</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{dietSelectedYmd}</div>
                <div className="mt-1 text-xs text-slate-600">{dietMealsByDay.get(dietSelectedYmd)?.length ?? 0} meals</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(dietMealsByDay.get(dietSelectedYmd) ?? []).map((meal) => {
                const foods = meal.items
                  .map((item) => item.food?.displayName || item.food?.name || `food#${item.foodId}`)
                  .slice(0, 3)
                  .join(' / ')
                return (
                  <div key={meal.id} className="profile-subpanel">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{meal.mealType}</div>
                        <div className="mt-1 text-xs text-slate-600">{foods || `${meal.items.length} items`}</div>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        <div>{meal.totals.kcal.toFixed(0)} kcal</div>
                        <div>
                          P {meal.totals.protein.toFixed(1)} / F {meal.totals.fat.toFixed(1)} / C {meal.totals.carbs.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {(dietMealsByDay.get(dietSelectedYmd) ?? []).length === 0 && !dietLoading ? (
                <div className="text-sm text-slate-600">No meals on this day</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
