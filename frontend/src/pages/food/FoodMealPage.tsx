import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFoods, getFoodsBulk, getTodaySummary, recognizeFoods, saveMeal } from '../../lib/food/api'
import type { FoodItem, FoodMealType } from '../../lib/food/types_runtime'
import { useAuth } from '../../state/auth-context'

const MEAL_META: Record<FoodMealType, { label: string; icon: string; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', icon: '🌅', color: '#f59e0b', bg: '#fffbeb' },
  lunch:     { label: 'Lunch',     icon: '☀️', color: '#22c55e', bg: '#f0fdf4' },
  dinner:    { label: 'Dinner',    icon: '🌙', color: '#6366f1', bg: '#eef2ff' },
  snack:     { label: 'Snack',     icon: '🍎', color: '#ef4444', bg: '#fef2f2' },
}

const CATEGORY_META = [
  { key: 'All',       icon: '🍽️', label: 'All',        color: '#6b7280', bg: '#f3f4f6' },
  { key: 'Grain',     icon: '🌾', label: 'Grain',      color: '#d97706', bg: '#fffbeb' },
  { key: 'Protein',   icon: '🥩', label: 'Protein',    color: '#dc2626', bg: '#fef2f2' },
  { key: 'Vegetable', icon: '🥦', label: 'Vegetable',  color: '#16a34a', bg: '#f0fdf4' },
  { key: 'Fruit',     icon: '🍎', label: 'Fruit',      color: '#ea580c', bg: '#fff7ed' },
  { key: 'Dairy',     icon: '🥛', label: 'Dairy',      color: '#2563eb', bg: '#eff6ff' },
  { key: 'Seafood',   icon: '🐟', label: 'Seafood',    color: '#0891b2', bg: '#ecfeff' },
  { key: 'Beverage',  icon: '🥤', label: 'Beverage',   color: '#7c3aed', bg: '#faf5ff' },
  { key: 'Other',     icon: '🍯', label: 'Other',      color: '#9333ea', bg: '#fdf4ff' },
]

function getFoodEmoji(name: string, category: string): string {
  const n = name.toLowerCase()
  if (n.includes('rice'))                            return '🍚'
  if (n.includes('bread') || n.includes('toast'))   return '🍞'
  if (n.includes('oat'))                             return '🥣'
  if (n.includes('pasta') || n.includes('spaghetti'))return '🍝'
  if (n.includes('noodle'))                          return '🍜'
  if (n.includes('corn') || n.includes('maize'))     return '🌽'
  if (n.includes('sweet potato'))                    return '🍠'
  if (n.includes('potato'))                          return '🥔'
  if (n.includes('pancake') || n.includes('waffle')) return '🥞'
  if (n.includes('bagel') || n.includes('muffin'))   return '🥐'
  if (n.includes('cereal') || n.includes('granola')) return '🥣'
  if (n.includes('chicken') || n.includes('poultry'))return '🍗'
  if (n.includes('beef') || n.includes('steak'))     return '🥩'
  if (n.includes('pork') || n.includes('bacon') || n.includes('ham'))return '🥓'
  if (n.includes('salmon'))                          return '🐟'
  if (n.includes('tuna'))                            return '🐟'
  if (n.includes('shrimp') || n.includes('prawn'))  return '🍤'
  if (n.includes('crab') || n.includes('lobster'))  return '🦞'
  if (n.includes('egg'))                             return '🥚'
  if (n.includes('tofu'))                            return '🫘'
  if (n.includes('bean') || n.includes('lentil') || n.includes('chickpea'))return '🫘'
  if (n.includes('nut') || n.includes('almond') || n.includes('walnut'))return '🥜'
  if (n.includes('broccoli'))                        return '🥦'
  if (n.includes('carrot'))                          return '🥕'
  if (n.includes('spinach') || n.includes('kale'))  return '🥬'
  if (n.includes('tomato'))                          return '🍅'
  if (n.includes('cucumber'))                        return '🥒'
  if (n.includes('pepper') || n.includes('capsicum'))return '🫑'
  if (n.includes('onion'))                           return '🧅'
  if (n.includes('garlic'))                          return '🧄'
  if (n.includes('mushroom'))                        return '🍄'
  if (n.includes('avocado'))                         return '🥑'
  if (n.includes('lettuce') || n.includes('salad')) return '🥗'
  if (n.includes('pea') || n.includes('edamame'))   return '🫛'
  if (n.includes('apple'))                           return '🍎'
  if (n.includes('banana'))                          return '🍌'
  if (n.includes('orange') || n.includes('mandarin'))return '🍊'
  if (n.includes('grape'))                           return '🍇'
  if (n.includes('strawberry'))                      return '🍓'
  if (n.includes('blueberry'))                       return '🫐'
  if (n.includes('watermelon'))                      return '🍉'
  if (n.includes('mango'))                           return '🥭'
  if (n.includes('pineapple'))                       return '🍍'
  if (n.includes('peach') || n.includes('nectarine'))return '🍑'
  if (n.includes('cherry'))                          return '🍒'
  if (n.includes('kiwi'))                            return '🥝'
  if (n.includes('lemon') || n.includes('lime'))    return '🍋'
  if (n.includes('milk'))                            return '🥛'
  if (n.includes('cheese'))                          return '🧀'
  if (n.includes('yogurt') || n.includes('yoghurt'))return '🫙'
  if (n.includes('butter'))                          return '🧈'
  if (n.includes('cream') || n.includes('ice cream'))return '🍦'
  if (n.includes('coffee') || n.includes('espresso'))return '☕'
  if (n.includes('tea'))                             return '🍵'
  if (n.includes('juice'))                           return '🥤'
  if (n.includes('water'))                           return '💧'
  if (n.includes('smoothie'))                        return '🥤'
  if (n.includes('oil') || n.includes('olive'))     return '🫙'
  if (n.includes('honey'))                           return '🍯'
  if (n.includes('chocolate'))                       return '🍫'
  if (n.includes('cookie') || n.includes('biscuit'))return '🍪'
  if (n.includes('cake') || n.includes('dessert'))  return '🍰'
  if (n.includes('pizza'))                           return '🍕'
  if (n.includes('burger'))                          return '🍔'
  if (n.includes('sandwich'))                        return '🥪'
  if (n.includes('soup'))                            return '🍜'
  const cat = category.toLowerCase()
  if (cat === 'grain')     return '🌾'
  if (cat === 'protein')   return '🥩'
  if (cat === 'vegetable') return '🥦'
  if (cat === 'fruit')     return '🍎'
  if (cat === 'dairy')     return '🥛'
  if (cat === 'seafood')   return '🐟'
  if (cat === 'beverage')  return '🥤'
  return '🍽️'
}

function getCategoryMeta(category: string) {
  return CATEGORY_META.find(c => c.key.toLowerCase() === category.toLowerCase())
    ?? { icon: '🍽️', color: '#6b7280', bg: '#f3f4f6', key: category, label: category }
}

export default function FoodMealPage() {
  const { mealType } = useParams()
  const auth = useAuth()
  const type = mealType as FoodMealType
  const meta = MEAL_META[type] ?? { label: type, icon: '🍽️', color: '#35cc95', bg: '#ecfdf5' }

  const [foods, setFoods] = useState<FoodItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [status, setStatus] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getFoods()
      .then((data) => { if (data) setFoods(data) })
      .catch((e: unknown) => setStatus({ type: 'error', text: e instanceof Error ? e.message : 'Unable to load foods' }))
    if (auth.user) {
      getTodaySummary().then((summary) => {
        const meal = summary.meals.find((m) => m.mealType === type)
        if (meal) setSelected(Object.fromEntries(meal.items.map((item) => [item.foodId, item.grams])))
      }).catch(() => {})
    }
  }, [auth.user, type])

  const visible = useMemo(() => {
    let list = foods
    if (category !== 'All') list = list.filter((f) => f.category.toLowerCase() === category.toLowerCase())
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((f) => `${f.displayName} ${f.name}`.toLowerCase().includes(q))
    }
    return list
  }, [foods, query, category])

  const totals = useMemo(() => Object.entries(selected).reduce(
    (acc, [id, grams]) => {
      const food = foods.find((f) => f.id === Number(id))
      if (!food) return acc
      const factor = grams / 100
      return { kcal: acc.kcal + food.calories * factor, protein: acc.protein + food.protein * factor, carbs: acc.carbs + food.carbs * factor, fat: acc.fat + food.fat * factor }
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  ), [foods, selected])

  const selectedCount = Object.keys(selected).length

  function toggleFood(food: FoodItem) {
    setSelected((prev) => {
      const next = { ...prev }
      if (food.id in next) delete next[food.id]
      else next[food.id] = 100
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
      const gramsByFoodId = new Map(result.matched.map((m) => [m.foodId, m.estimatedGrams]))
      const matched = await getFoodsBulk(result.matched.map((m) => m.foodId))
      setSelected((prev) => ({
        ...prev,
        ...Object.fromEntries(matched.map((f) => [f.id, Math.round(gramsByFoodId.get(f.id) || 100)])),
      }))
      setStatus(result.unmatchedNames.length
        ? { type: 'info', text: `Added ${matched.length} food(s) — check the estimated weight, it's a rough guess. Unrecognized: ${result.unmatchedNames.join(', ')}` }
        : { type: 'success', text: `${matched.length} food(s) added — check the estimated weight, it's a rough guess.` })
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

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            <Link to="/food" style={{ color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 600 }}>Nutrition</Link>
            <span>/</span>
            <span>{meta.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
              {meta.icon}
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>{meta.label}</h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>Select foods and set portions</p>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div style={{
          background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
          padding: '14px 20px', boxShadow: 'var(--shadow-soft)', marginBottom: 20,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text-primary)' }}>{totals.kcal.toFixed(0)}</span>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>kcal</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 4 }}>· {selectedCount} selected</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'P', value: totals.protein, color: '#3b82f6', bg: '#eff6ff' },
              { label: 'C', value: totals.carbs,   color: '#f59e0b', bg: '#fffbeb' },
              { label: 'F', value: totals.fat,     color: '#ef4444', bg: '#fef2f2' },
            ].map(({ label, value, color, bg }) => (
              <span key={label} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: bg, color }}>
                {label} {value.toFixed(1)}g
              </span>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={recognizing}
              style={{ height: 38, padding: '0 14px', borderRadius: 999, border: '1.5px solid var(--color-border-default)', background: 'var(--color-bg-soft)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              📷 {recognizing ? 'Recognizing…' : 'Photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && void handleRecognize(e.target.files[0])} />
            <button type="button" onClick={() => void handleSave()} disabled={saving || selectedCount === 0}
              className="app-btn app-btn--brand" style={{ height: 38, padding: '0 18px', fontSize: 13 }}>
              {saving ? 'Saving…' : `Save ${meta.label}`}
            </button>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div style={{
            borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 16, fontSize: 13, fontWeight: 500,
            background: status.type === 'error' ? 'var(--color-error-bg)' : status.type === 'success' ? 'var(--color-success-bg)' : '#eff6ff',
            color: status.type === 'error' ? 'var(--color-error)' : status.type === 'success' ? 'var(--color-success)' : '#2563eb'
          }}>
            {status.text}
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', maxWidth: 360 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>🔍</span>
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods…"
              style={{ width: '100%', height: 42, paddingLeft: 42, paddingRight: 16, borderRadius: 999, border: '1.5px solid var(--color-border-default)', background: 'var(--color-bg-surface)', fontSize: 14, color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Category tabs — horizontal scroll on mobile */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {CATEGORY_META.map((cat) => {
            const active = category === cat.key
            return (
              <button key={cat.key} type="button" onClick={() => setCategory(cat.key)}
                style={{
                  flexShrink: 0, height: 36, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.15s',
                  border: `1.5px solid ${active ? cat.color : 'var(--color-border-default)'}`,
                  background: active ? cat.bg : 'var(--color-bg-surface)',
                  color: active ? cat.color : 'var(--color-text-muted)',
                }}>
                <span>{cat.icon}</span> {cat.label}
              </button>
            )
          })}
        </div>

        {/* Food card grid — fixed-size square cards */}
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 15 }}>No foods found{query ? ` for "${query}"` : ''}.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, 148px)',
            gap: 12,
          }}>
            {visible.map((food) => {
              const isSelected = food.id in selected
              const grams = selected[food.id] ?? 100
              const foodKcal = ((food.calories * grams) / 100).toFixed(0)
              const emoji = getFoodEmoji(food.displayName, food.category)
              const catMeta = getCategoryMeta(food.category)

              return (
                <div key={food.id}
                  onClick={() => toggleFood(food)}
                  style={{
                    width: 148,
                    background: isSelected ? `${catMeta.bg}` : 'var(--color-bg-surface)',
                    borderRadius: 20,
                    border: `2px solid ${isSelected ? catMeta.color : 'var(--color-border-default)'}`,
                    cursor: 'pointer',
                    padding: isSelected ? '12px 10px 10px' : '16px 10px 12px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? `0 0 0 3px ${catMeta.color}22` : 'var(--shadow-soft)',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Checkmark badge */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%',
                      background: catMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                        <path d="M1 3.5L3.5 6L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}

                  {/* Emoji icon */}
                  <div style={{
                    width: 60, height: 60, borderRadius: 16,
                    background: catMeta.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 30, flexShrink: 0,
                    border: `1.5px solid ${catMeta.color}30`
                  }}>
                    {emoji}
                  </div>

                  {/* Name */}
                  <p style={{
                    margin: 0, fontSize: 12, fontWeight: 700, textAlign: 'center',
                    color: 'var(--color-text-primary)', lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    width: '100%'
                  }}>
                    {food.displayName}
                  </p>

                  {/* Kcal */}
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    {food.calories} kcal/100g
                  </p>

                  {/* Gram input when selected */}
                  {isSelected && (
                    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number" min={1} max={2000} value={grams}
                          onChange={(e) => setGrams(food.id, Math.max(1, Number(e.target.value)))}
                          style={{ width: 54, height: 26, borderRadius: 8, border: `1.5px solid ${catMeta.color}`, textAlign: 'center', fontSize: 12, fontWeight: 700, background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', outline: 'none' }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>g</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: catMeta.color }}>= {foodKcal} kcal</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </section>
  )
}
