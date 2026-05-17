import { Link } from 'react-router-dom'
import type { MutableRefObject } from 'react'
import type { CartItem } from '../../modules/food/mealEditor'
import { formatMetricParts, quickGramSteps } from '../../modules/food/mealEditor'

type MealDraftPanelProps = {
  selectedItems: CartItem[]
  selectedCount: number
  totals: {
    kcal: number
    protein: number
    fat: number
    carbs: number
  }
  gramsInputRefs: MutableRefObject<Record<number, HTMLInputElement | null>>
  authError: boolean
  successHint: string | null
  error: string | null
  lastErrorAction: 'load' | 'save' | 'delete' | null
  busy: boolean
  savedMealId: number | null
  onClearDraft: () => void
  onRemoveFood: (foodId: number) => void
  onUpdateGrams: (foodId: number, grams: number) => void
  onSave: () => void
  onDeleteMeal: () => void
  onLogout: () => void
}

export function MealDraftPanel(props: MealDraftPanelProps) {
  const {
    selectedItems,
    selectedCount,
    totals,
    gramsInputRefs,
    authError,
    successHint,
    error,
    lastErrorAction,
    busy,
    savedMealId,
    onClearDraft,
    onRemoveFood,
    onUpdateGrams,
    onSave,
    onDeleteMeal,
    onLogout
  } = props

  return (
    <div className="cl_blog-widget food-meal-draft-sticky">
      <div className="food-meal-draft-head">
        <h4 className="cl_blog-widget-title section-title-none">Meal Draft</h4>
        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={onClearDraft}
            className="food-meal-clear-btn"
          >
            Clear
          </button>
        ) : null}
      </div>

      {selectedCount === 0 ? (
        <div className="food-meal-muted food-meal-muted-top">
          No food selected yet. Pick from the library or use image recognition to build the meal draft.
        </div>
      ) : (
        <div className="food-meal-draft-list">
          {selectedItems.map((item) => (
            <div key={item.food.id} className="food-meal-draft-card">
              <div className="food-meal-draft-card-head">
                <div>
                  <div className="food-meal-draft-name">{item.food.displayName}</div>
                  <div className="food-meal-draft-kcal">
                    {Math.round((item.food.calories * item.grams) / 100)} kcal current serving
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFood(item.food.id)}
                  className="food-meal-remove-btn"
                >
                  Remove
                </button>
              </div>
              <div className="food-meal-draft-controls">
                <input
                  type="number"
                  min={1}
                  value={item.grams}
                  onChange={(event) => {
                    const grams = Number(event.target.value)
                    if (Number.isFinite(grams) && grams > 0) onUpdateGrams(item.food.id, grams)
                  }}
                  ref={(el) => {
                    gramsInputRefs.current[item.food.id] = el
                  }}
                  className="food-meal-grams-input"
                />
                <div className="food-chip-row">
                  {quickGramSteps.map((grams) => (
                    <button
                      key={grams}
                      type="button"
                      onClick={() => onUpdateGrams(item.food.id, grams)}
                      className={`food-meal-gram-btn${item.grams === grams ? ' is-active' : ''}`}
                    >
                      {grams}g
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onUpdateGrams(item.food.id, item.grams + 25)}
                    className="food-meal-gram-btn"
                  >
                    +25g
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="food-meal-summary">
        {authError ? (
          <div className="food-notice food-notice--warn">
            <div className="food-meal-notice-title">Login expired</div>
            <div className="food-meal-notice-text">
              Your session is no longer valid for meal records. Re-login before saving or loading this meal.
            </div>
            <div className="section-actions-row section-actions-row-tight">
              <Link to="/login" className="cl_theme-btn">
                Go Login
              </Link>
              <button type="button" className="cl_theme-btn" onClick={onLogout}>
                Clear Session
              </button>
            </div>
          </div>
        ) : null}
        {successHint ? (
          <div className="food-notice food-notice--success">
            <div className="food-meal-notice-title">Saved</div>
            <div className="food-meal-notice-text">{successHint}</div>
          </div>
        ) : null}
        {error && !authError ? (
          <div className="food-notice food-notice--error">
            <div className="food-meal-notice-title">Action failed</div>
            <div className="food-meal-notice-text">{error}</div>
            {lastErrorAction === 'save' ? (
              <div className="section-actions-row section-actions-row-tight">
                <button
                  type="button"
                  className="cl_theme-btn"
                  onClick={onSave}
                  disabled={busy || selectedCount === 0}
                >
                  Retry Save
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="food-meal-side-metrics">
          <MealMetric tone="calories" icon="🔥" label="Calories" value={totals.kcal} unit="kcal" />
          <MealMetric tone="protein" icon="💪" label="Protein" value={totals.protein} unit="g" />
          <MealMetric tone="fat" icon="🥑" label="Fat" value={totals.fat} unit="g" />
          <MealMetric tone="carbs" icon="🍚" label="Carbs" value={totals.carbs} unit="g" />
        </div>

        <div className="section-actions-row section-actions-row-top">
          <button
            type="button"
            className="cl_theme-btn"
            onClick={onSave}
            disabled={busy || selectedCount === 0}
          >
            {busy ? 'Saving...' : 'Save Meal'}
          </button>
          {savedMealId ? (
            <button
              type="button"
              className="cl_theme-btn"
              onClick={onDeleteMeal}
              disabled={busy}
            >
              Delete Meal
            </button>
          ) : null}
          <Link to="/food" className="cl_theme-btn">
            Back to Module
          </Link>
        </div>
      </div>
    </div>
  )
}

function MealMetric(props: { tone: string; icon: string; label: string; value: number; unit: string }) {
  const metric = formatMetricParts(props.value, props.unit)
  return (
    <div className={`food-module-metric food-module-metric--${props.tone}`}>
      <div className="food-module-metric-label">
        <span className="food-module-metric-icon">{props.icon}</span> {props.label}
      </div>
      <div className="food-module-metric-value">
        <span className="food-module-metric-number">{metric.numberText}</span>
        <span className="food-module-metric-unit">{metric.unitText}</span>
      </div>
    </div>
  )
}
