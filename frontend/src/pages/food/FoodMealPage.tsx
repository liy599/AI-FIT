import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFoods, getFoodsBulk, getTodaySummary, recognizeFoods, saveMeal } from '../../lib/food/api'
import type { FoodItem, FoodMealType } from '../../lib/food/types_runtime'
import { useAuth } from '../../state/auth-context'

const MEAL_META: Record<FoodMealType, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast', icon: '🌅' },
  lunch: { label: 'Lunch', icon: '☀️' },
  dinner: { label: 'Dinner', icon: '🌙' },
  snack: { label: 'Snack', icon: '🍎' },
}

const CATEGORIES = ['All', 'Grain', 'Protein', 'Vegetable', 'Fruit', 'Dairy', 'Other']

function FoodPlaceholder({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <div style={{
      width: '100%', height: 120, background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'var(--radius-md)', fontSize: 32, fontWeight: 800,
      color: 'var(--color-brand)'
    }}>
      {initial}
    </div>
  )
}

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, fontWeight: 600, padding: '2px 8px',
      borderRadius: 999, background: `${color}18`, color
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}: {value.toFixed(1)}g
    </span>
  )
}

export default function FoodMealPage() {
  const { mealType } = useParams()
  const auth = useAuth()
  const type = mealType as FoodMealType
  const meta = MEAL_META[type] ?? { label: type, icon: '🍽️' }

  const [foods, setFoods] = useState<FoodItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [status, setStatus] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getFoods().catch((e: unknown) => setStatus({ type: 'error', text: e instanceof Error ? e.message : 'Unable to load foods' })).then((data) => {
      if (data) setFoods(data)
    })
    if (auth.user) {
      getTodaySummary().then((summary) => {
        const meal = summary.meals.find((m) => m.mealType === type)
        if (meal) setSelected(Object.fromEntries(meal.items.map((item) => [item.foodId, item.grams])))
      }).catch(() => {})
    }
  }, [auth.user, type])

  const visible = useMemo(() => {
    let list = foods
    if (category !== 'All') {
      list = list.filter((f) => f.category.toLowerCase() === category.toLowerCase())
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((f) => `${f.displayName} ${f.name}`.toLowerCase().includes(q))
    }
    return list
  }, [foods, query, category])

  const totals = useMemo(() => {
    return Object.entries(selected).reduce(
      (acc, [id, grams]) => {
        const food = foods.find((f) => f.id === Number(id))
        if (!food) return acc
        const factor = grams / 100
        return {
          kcal: acc.kcal + food.calories * factor,
          protein: acc.protein + food.protein * factor,
          carbs: acc.carbs + food.carbs * factor,
          fat: acc.fat + food.fat * factor,
        }
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    )
  }, [foods, selected])

  const selectedCount = Object.keys(selected).length

  function toggleFood(food: FoodItem) {
    setSelected((prev) => {
      const next = { ...prev }
      if (food.id in next) {
        delete next[food.id]
      } else {
        next[food.id] = 100
      }
      return next
    })
  }

  function setGrams(foodId: number, grams: number) {
    setSelected((prev) => ({ ...prev, [foodId]: grams }))
  }

  async function handleRecognize(file: File) {
    setRecognizing(true)
    setStatus({ type: 'info', text: 'Recognizing foods from image…' })
    try {
      const result = await recognizeFoods(file)
      const matched = await getFoodsBulk(result.foodIds)
      setSelected((prev) => ({
        ...prev,
        ...Object.fromEntries(matched.map((f) => [f.id, 100])),
      }))
      setStatus(
        result.unmatchedNames.length
          ? { type: 'info', text: `Added ${matched.length} food(s). Unrecognized: ${result.unmatchedNames.join(', ')}` }
          : { type: 'success', text: `${matched.length} food(s) added from image.` }
      )
    } catch (e: unknown) {
      setStatus({ type: 'error', text: e instanceof Error ? e.message : 'Image recognition failed' })
    } finally {
      setRecognizing(false)
    }
  }

  async function handleSave() {
    if (!auth.user) { setStatus({ type: 'error', text: 'Please sign in to save meals.' }); return }
    setSaving(true)
    try {
      await saveMeal(type, Object.entries(selected).map(([foodId, grams]) => ({ foodId: Number(foodId), grams })))
      setStatus({ type: 'success', text: 'Meal saved successfully!' })
    } catch (e: unknown) {
      setStatus({ type: 'error', text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pt-100 pb-100">
      <div className="container">

        {/* Breadcrumb + header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            <Link to="/food" style={{ color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 600 }}>Nutrition</Link>
            <span>/</span>
            <span>{meta.label}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{meta.icon}</span> {meta.label}
          </h1>
        </div>

        {/* Live macro summary bar */}
        <div style={{
          background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
          padding: '16px 24px', boxShadow: 'var(--shadow-soft)', marginBottom: 24,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {totals.kcal.toFixed(0)}{' '}
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-muted)' }}>kcal</span>
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MacroChip label="Protein" value={totals.protein} color="#3b82f6" />
            <MacroChip label="Carbs" value={totals.carbs} color="#f59e0b" />
            <MacroChip label="Fat" value={totals.fat} color="#ef4444" />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={recognizing}
              style={{
                height: 40, padding: '0 16px', borderRadius: 999,
                border: '1.5px solid var(--color-border-default)',
                background: 'var(--color-bg-soft)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              📷 {recognizing ? 'Recognizing…' : 'Photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleRecognize(e.target.files[0])} />

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || selectedCount === 0}
              className="app-btn app-btn--brand"
              style={{ height: 40, padding: '0 20px', fontSize: 14 }}
            >
              {saving ? 'Saving…' : `Save ${meta.label}`}
            </button>
          </div>
        </div>

        {/* Status message */}
        {status && (
          <div style={{
            borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 20, fontSize: 14, fontWeight: 500,
            background: status.type === 'error' ? 'var(--color-error-bg)' : status.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-info-bg)',
            color: status.type === 'error' ? 'var(--color-error)' : status.type === 'success' ? 'var(--color-success)' : 'var(--color-info)'
          }}>
            {status.text}
          </div>
        )}

        {/* Search + category filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods…"
            style={{
              flex: '1 1 220px', height: 44, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--color-border-default)', background: 'var(--color-bg-surface)',
              fontSize: 14, color: 'var(--color-text-primary)', outline: 'none'
            }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                  border: '1.5px solid',
                  borderColor: category === cat ? 'var(--color-brand)' : 'var(--color-border-default)',
                  background: category === cat ? 'rgba(52, 204, 149, 0.1)' : 'var(--color-bg-surface)',
                  color: category === cat ? 'var(--color-brand)' : 'var(--color-text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Food grid */}
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: 16 }}>No foods found{query ? ` for "${query}"` : ''}.</p>
          </div>
        ) : (
          <div className="row">
            {visible.map((food) => {
              const isSelected = food.id in selected
              const grams = selected[food.id] ?? 100
              const foodKcal = ((food.calories * grams) / 100).toFixed(0)
              return (
                <div className="col-xl-3 col-md-4 col-sm-6" key={food.id} style={{ marginBottom: 20 }}>
                  <div
                    onClick={() => toggleFood(food)}
                    style={{
                      background: 'var(--color-bg-surface)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-soft)',
                      border: isSelected ? '2px solid var(--color-brand)' : '2px solid transparent',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      position: 'relative'
                    }}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 1,
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                          <path d="M1 4.5L4.5 8L12 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}

                    {food.imageUrl
                      ? <img src={food.imageUrl} alt={food.displayName} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                      : <FoodPlaceholder name={food.displayName} />
                    }

                    <div style={{ padding: '12px 14px 14px' }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                        {food.displayName}
                      </p>
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {food.calories} kcal / 100g
                      </p>

                      {isSelected && (
                        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            Grams:
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={2000}
                            value={grams}
                            onChange={(e) => setGrams(food.id, Math.max(1, Number(e.target.value)))}
                            style={{
                              width: 70, height: 30, padding: '0 8px',
                              border: '1.5px solid var(--color-brand)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 13, fontWeight: 700, textAlign: 'center',
                              color: 'var(--color-text-primary)',
                              background: 'var(--color-bg-soft)', outline: 'none'
                            }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand)', whiteSpace: 'nowrap' }}>
                            = {foodKcal} kcal
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#3b82f6', background: '#eff6ff', padding: '2px 7px', borderRadius: 999 }}>
                          P {food.protein}g
                        </span>
                        <span style={{ fontSize: 11, color: '#d97706', background: '#fffbeb', padding: '2px 7px', borderRadius: 999 }}>
                          C {food.carbs}g
                        </span>
                        <span style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', padding: '2px 7px', borderRadius: 999 }}>
                          F {food.fat}g
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </section>
  )
}
