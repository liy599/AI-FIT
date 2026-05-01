import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deleteMeal, getFoodCategories, getFoodsBulk, getFoodsPage, getTodaySummary, recognizeFoods, saveMeal } from '../lib/food/api'
import type { FoodItem, FoodMealType } from '../lib/food/types_runtime'
import { useAuth } from '../state/auth-context'
import '../styles/food-module.css'

type CartItem = {
  food: FoodItem
  grams: number
}

type RecognitionSummary = {
  fileName: string
  recognizedNames: string[]
  matchedNames: string[]
  unmatchedNames: string[]
}

const mealTitles: Record<FoodMealType, { title: string; note: string; accent: string }> = {
  breakfast: {
    title: 'Breakfast',
    note: 'Start with a clean first meal and keep the morning intake visible.',
    accent: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)'
  },
  lunch: {
    title: 'Lunch',
    note: 'Build the midday meal with fast selection, image recognition, and formal save.',
    accent: 'linear-gradient(135deg, #10b981 0%, #0f766e 100%)'
  },
  dinner: {
    title: 'Dinner',
    note: 'Review evening intake with a structured draft before saving into today.',
    accent: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
  },
  snack: {
    title: 'Snack',
    note: 'Track add-on foods separately so the main meals stay clean.',
    accent: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
  }
}

const quickGramSteps = [50, 100, 150, 200]
const FOODS_PAGE_SIZE = 20

function isMealType(value: string | undefined): value is FoodMealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack'
}

function calcTotals(cart: Record<number, CartItem>) {
  let kcal = 0
  let protein = 0
  let fat = 0
  let carbs = 0
  for (const item of Object.values(cart)) {
    const factor = item.grams / 100
    kcal += item.food.calories * factor
    protein += item.food.protein * factor
    fat += item.food.fat * factor
    carbs += item.food.carbs * factor
  }
  return {
    kcal: Number(kcal.toFixed(2)),
    protein: Number(protein.toFixed(2)),
    fat: Number(fat.toFixed(2)),
    carbs: Number(carbs.toFixed(2))
  }
}

function formatMetricParts(value: number | undefined, unit: string) {
  if (value == null) return { numberText: '--', unitText: unit }
  return { numberText: value.toFixed(1), unitText: unit }
}

function formatMacro(value: number, unit: string) {
  return `${value.toFixed(1)} ${unit}`
}

function emojiForFoodCategory(category: string) {
  const value = category.trim().toLowerCase()
  if (!value) return '🏷️'
  if (value.includes('western') || value.includes('西方')) return '🍞'
  if (value.includes('eastern') || value.includes('东方') || value.includes('chinese') || value.includes('中式')) return '🥟'
  if (value.includes('fruit') || value.includes('水果')) return '🍎'
  if (value.includes('veget') || value.includes('蔬')) return '🥬'
  if (value.includes('meat') || value.includes('肉')) return '🥩'
  if (value.includes('fish') || value.includes('sea') || value.includes('海鲜')) return '🐟'
  if (value.includes('egg') || value.includes('蛋')) return '🥚'
  if (value.includes('milk') || value.includes('dairy') || value.includes('奶')) return '🥛'
  if (value.includes('grain') || value.includes('rice') || value.includes('bread') || value.includes('谷') || value.includes('米') || value.includes('面')) return '🍚'
  if (value.includes('snack') || value.includes('零食')) return '🍪'
  if (value.includes('drink') || value.includes('beverage') || value.includes('饮')) return '🥤'
  if (value.includes('nut') || value.includes('坚果')) return '🥜'
  return '🍽️'
}

function isAuthErrorMessage(message: string | null) {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes('authorization') ||
    normalized.includes('token has expired') ||
    normalized.includes('jwt') ||
    normalized.includes('signature verification failed')
  )
}

function mapRecognizeErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : 'Recognize failed'
  const normalized = raw.toLowerCase()
  if (normalized.includes('stepfun not configured')) {
    return 'Image recognition is not enabled on the server. Ask the admin to set STEPFUN_API_URL and STEPFUN_API_KEY (or AI_REPORT_API_URL and AI_REPORT_API_KEY), then restart backend.'
  }
  if (normalized.includes('stepfun_failed')) {
    return 'Image recognition provider failed. Please retry later or check backend provider credentials.'
  }
  return raw
}

export default function FoodMealPage() {
  const params = useParams()
  const auth = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const gramsInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const didInitFoodsQueryRef = useRef(false)
  const routeMealType = isMealType(params.mealType) ? params.mealType : null
  const mealType = routeMealType ?? 'lunch'
  const meal = mealTitles[mealType]

  const [foods, setFoods] = useState<FoodItem[]>([])
  const [foodCategories, setFoodCategories] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [cart, setCart] = useState<Record<number, CartItem>>({})
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastErrorAction, setLastErrorAction] = useState<'load' | 'save' | 'delete' | null>(null)
  const [savedMealId, setSavedMealId] = useState<number | null>(null)
  const [foodsPage, setFoodsPage] = useState(1)
  const [foodsTotalPages, setFoodsTotalPages] = useState(1)
  const [foodsTotal, setFoodsTotal] = useState(0)
  const [foodsLoadingPage, setFoodsLoadingPage] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [recognizeHint, setRecognizeHint] = useState<string | null>(null)
  const [successHint, setSuccessHint] = useState<string | null>(null)
  const [recognizeSuccessHint, setRecognizeSuccessHint] = useState<string | null>(null)
  const [recognitionSummary, setRecognitionSummary] = useState<RecognitionSummary | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const uploadedImageUrlRef = useRef<string | null>(null)
  const authError = isAuthErrorMessage(error)

  useEffect(() => {
    let cancelled = false
    if (!routeMealType) {
      setLoading(false)
      setError('Invalid meal type')
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    setError(null)
    setLastErrorAction(null)
    setSuccessHint(null)
    setRecognizeHint(null)
    setRecognizeSuccessHint(null)
    Promise.all([
      getFoodsPage({ limit: FOODS_PAGE_SIZE, page: 1 }),
      getFoodCategories(),
      auth.user ? getTodaySummary() : Promise.resolve(null)
    ])
      .then(([foodsPageResult, categoriesResult, summary]) => {
        if (cancelled) return
        setFoods(foodsPageResult.items)
        setFoodsPage(foodsPageResult.page)
        setFoodsTotal(foodsPageResult.total)
        setFoodsTotalPages(Math.max(1, Math.ceil(foodsPageResult.total / foodsPageResult.limit)))
        setFoodCategories(categoriesResult)
        if (summary) {
          const existingMeal = summary.meals.find((item) => item.mealType === mealType) ?? null
          setSavedMealId(existingMeal?.id ?? null)
          if (existingMeal) {
            const nextCart: Record<number, CartItem> = {}
            for (const item of existingMeal.items) {
              if (!item.food) continue
              nextCart[item.food.id] = {
                food: item.food,
                grams: item.grams
              }
            }
            setCart(nextCart)
          } else {
            setCart({})
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load meal editor')
          setLastErrorAction('load')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [auth.user, mealType, routeMealType])

  useEffect(() => {
    return () => {
      if (uploadedImageUrlRef.current) URL.revokeObjectURL(uploadedImageUrlRef.current)
    }
  }, [])

  const categories = useMemo(() => {
    const unique = new Set((foodCategories.length ? foodCategories : foods.map((item) => item.category)).filter(Boolean))
    if (selectedCategory !== 'all') unique.add(selectedCategory)
    return ['all', ...Array.from(unique)]
  }, [foodCategories, foods, selectedCategory])

  const selectedItems = useMemo(() => Object.values(cart), [cart])
  const totals = useMemo(() => calcTotals(cart), [cart])
  const selectedCount = selectedItems.length
  const pageNumbers = useMemo(() => {
    const total = foodsTotalPages
    const current = foodsPage
    if (total <= 1) return []
    const windowSize = 7
    let start = Math.max(1, current - Math.floor(windowSize / 2))
    let end = Math.min(total, start + windowSize - 1)
    start = Math.max(1, end - windowSize + 1)
    const pages: number[] = []
    for (let p = start; p <= end; p += 1) pages.push(p)
    return pages
  }, [foodsPage, foodsTotalPages])

  useEffect(() => {
    if (!didInitFoodsQueryRef.current) {
      didInitFoodsQueryRef.current = true
      return
    }

    let cancelled = false
    setFoodsLoadingPage(true)
    const timer = window.setTimeout(() => {
      const q = query.trim()
      const category = selectedCategory === 'all' ? undefined : selectedCategory
      getFoodsPage({ limit: FOODS_PAGE_SIZE, page: 1, q: q || undefined, category })
        .then((result) => {
          if (cancelled) return
          setFoods(result.items)
          setFoodsPage(result.page)
          setFoodsTotal(result.total)
          setFoodsTotalPages(Math.max(1, Math.ceil(result.total / result.limit)))
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setError(err instanceof Error ? err.message : 'Failed to load foods')
          setLastErrorAction('load')
        })
        .finally(() => {
          if (!cancelled) setFoodsLoadingPage(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, selectedCategory])

  function focusSearch() {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
  }

  function focusGrams(foodId: number) {
    requestAnimationFrame(() => {
      const el = gramsInputRefs.current[foodId]
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el.focus()
        el.select()
      }
    })
  }

  function toggleFood(food: FoodItem) {
    setError(null)
    setSuccessHint(null)
    setRecognizeHint(null)
    setRecognizeSuccessHint(null)
    const wasSelected = Boolean(cart[food.id])
    setCart((prev) => {
      const next = { ...prev }
      if (next[food.id]) {
        delete next[food.id]
      } else {
        next[food.id] = { food, grams: 100 }
      }
      return next
    })
    if (!wasSelected) focusGrams(food.id)
  }

  function updateGrams(foodId: number, grams: number) {
    setError(null)
    setSuccessHint(null)
    setCart((prev) => {
      const current = prev[foodId]
      if (!current) return prev
      return {
        ...prev,
        [foodId]: {
          ...current,
          grams: Math.max(1, Math.round(grams))
        }
      }
    })
  }

  function removeFood(foodId: number) {
    setCart((prev) => {
      const next = { ...prev }
      delete next[foodId]
      return next
    })
  }

  async function gotoFoodsPage(nextPage: number) {
    if (foodsLoadingPage) return
    const targetPage = Math.min(Math.max(1, nextPage), foodsTotalPages)
    setFoodsLoadingPage(true)
    try {
      const q = query.trim()
      const category = selectedCategory === 'all' ? undefined : selectedCategory
      const result = await getFoodsPage({ limit: FOODS_PAGE_SIZE, page: targetPage, q: q || undefined, category })
      setFoods(result.items)
      setFoodsPage(result.page)
      setFoodsTotal(result.total)
      setFoodsTotalPages(Math.max(1, Math.ceil(result.total / result.limit)))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load foods')
      setLastErrorAction('load')
    } finally {
      setFoodsLoadingPage(false)
    }
  }

  async function handleRecognize(file: File) {
    setError(null)
    setSuccessHint(null)
    setRecognizeHint(null)
    setRecognizeSuccessHint(null)
    setRecognizing(true)
    try {
      if (uploadedImageUrlRef.current) URL.revokeObjectURL(uploadedImageUrlRef.current)
      const objectUrl = URL.createObjectURL(file)
      uploadedImageUrlRef.current = objectUrl
      setUploadedImageUrl(objectUrl)
      setRecognitionSummary({
        fileName: file.name,
        recognizedNames: [],
        matchedNames: [],
        unmatchedNames: []
      })
      const result = await recognizeFoods(file)
      setRecognitionSummary({
        fileName: file.name,
        recognizedNames: result.names,
        matchedNames: [],
        unmatchedNames: result.unmatchedNames
      })
      if (result.foodIds.length === 0) {
        setRecognizeHint(result.unmatchedNames.length ? `Unmatched: ${result.unmatchedNames.join(', ')}` : 'No food matched.')
        return
      }
      const recognizedItems = await getFoodsBulk(result.foodIds)
      const matchedNames = recognizedItems.map((item) => item.displayName)
      setRecognitionSummary({
        fileName: file.name,
        recognizedNames: result.names,
        matchedNames,
        unmatchedNames: result.unmatchedNames
      })
      setCart((prev) => {
        const next = { ...prev }
        for (const item of recognizedItems) {
          if (!next[item.id]) {
            next[item.id] = { food: item, grams: 100 }
          }
        }
        return next
      })
      setRecognizeSuccessHint(`Added ${recognizedItems.length} food item(s) from image recognition.`)
      if (result.unmatchedNames.length) {
        setRecognizeHint(`Partially matched. Unmatched: ${result.unmatchedNames.join(', ')}`)
      }
      if (recognizedItems.length > 0) focusGrams(recognizedItems[0].id)
    } catch (err: unknown) {
      setRecognizeHint(mapRecognizeErrorMessage(err))
    } finally {
      setRecognizing(false)
    }
  }

  async function handleSave() {
    if (selectedCount === 0) {
      setError('Select at least one food before saving')
      setLastErrorAction('save')
      return
    }
    setBusy(true)
    setError(null)
    setLastErrorAction(null)
    setSuccessHint(null)
    try {
      const saved = await saveMeal(
        mealType,
        selectedItems.map((item) => ({
          foodId: item.food.id,
          grams: item.grams
        }))
      )
      setSavedMealId(saved.id)
      setSuccessHint(`${meal.title} saved to today's formal meal record.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setLastErrorAction('save')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteMeal() {
    if (!savedMealId) return
    setBusy(true)
    setError(null)
    setLastErrorAction(null)
    setSuccessHint(null)
    try {
      await deleteMeal(savedMealId)
      setSavedMealId(null)
      setCart({})
      setSuccessHint(`${meal.title} meal record deleted.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setLastErrorAction('delete')
    } finally {
      setBusy(false)
    }
  }

  function clearDraft() {
    setCart({})
    setError(null)
    setLastErrorAction(null)
    setSuccessHint(null)
    setRecognizeHint(null)
    setRecognizeSuccessHint(null)
  }

  if (!routeMealType) {
    return (
      <>
        <section className="cl_breadcrumb-area">
          <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
            <div className="container">
              <div className="row justify-content-center">
                <div className="col-md-9 col-12">
                  <div className="cl_breadcrumb-content">
                    <h2 className="cl_breadcrumb-content-title">Invalid Meal Slot</h2>
                    <div className="cl_breadcrumb-content-list">
                      <Link to="/">Home</Link>
                      <span aria-hidden="true" />
                      <Link to="/food">Food Module</Link>
                      <span>Invalid Meal Slot</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pt-100 pb-100">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-9">
                <div className="cl_blog-widget">
                  <h4 className="cl_blog-widget-title mb-20">Route Not Supported</h4>
                  <p style={{ color: '#64748b', marginBottom: 18 }}>
                    This meal route is not part of the formal food flow. Use breakfast, lunch, dinner, or snack.
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link to="/food" className="cl_theme-btn">
                      Back to Food
                    </Link>
                    <Link to="/food/meal/lunch" className="cl_theme-btn">
                      Open Lunch
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">{meal.title}</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span aria-hidden="true" />
                    <Link to="/food">Food Module</Link>
                    <span>{meal.title}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="container">
          {!auth.user ? (
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-9">
                <div className="cl_blog-widget">
                  <h4 className="cl_blog-widget-title mb-20">{meal.title} Editor</h4>
                  <p style={{ color: '#64748b', marginBottom: 18 }}>
                    Meal records are now bound to the formal AI-FIT account. Login first to continue.
                  </p>
                  <Link to="/login" className="cl_theme-btn">
                    Go Login
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="row">
              <div className="col-xl-8 col-lg-7">
                <div
                  className="cl_blog-widget mb-30"
                  style={{
                    background: meal.accent,
                    color: '#fff',
                    border: 'none',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ maxWidth: 620 }}>
                      <div style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.78 }}>
                        Formal Meal Editor
                      </div>
                      <h3 style={{ fontSize: 34, lineHeight: 1.15, marginTop: 10, marginBottom: 12, fontWeight: 900 }}>
                        {meal.title}
                      </h3>
                      <p style={{ marginBottom: 0, color: 'rgba(255,255,255,0.86)' }}>{meal.note}</p>
                    </div>
                  </div>
                </div>

                <div className="cl_blog-widget mb-30">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <h4 className="cl_blog-widget-title mb-15">Select Foods</h4>
                      <p style={{ color: '#64748b', marginBottom: 0 }}>
                        Search the formal food library, filter by category, or add foods from image recognition.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={recognizing}
                      style={{
                        width: '100%',
                        borderRadius: 22,
                        border: '1.5px dashed rgba(15, 118, 110, 0.35)',
                        background: recognizing ? '#f0fdfa' : 'linear-gradient(180deg, #f8fffd 0%, #ecfdf5 100%)',
                        padding: '26px 24px',
                        textAlign: 'left',
                        display: 'grid',
                        gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                            {recognizing ? 'Recognizing image...' : 'Upload an image to recognize foods'}
                          </div>
                          <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>
                            Click to choose a photo. We will identify foods and add matched items into the current meal draft.
                          </div>
                        </div>
                        <div
                          style={{
                            minHeight: 42,
                            padding: '0 18px',
                            borderRadius: 999,
                            background: '#10b981',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700
                          }}
                        >
                          {recognizing ? 'Recognizing...' : 'Choose Image'}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: '#0f766e' }}>
                        JPG, PNG, or other common image formats are supported.
                      </div>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void handleRecognize(file)
                      }}
                    />

                    {recognitionSummary ? (
                      <div className="food-meal-recognition-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Latest Recognition</div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{recognitionSummary.fileName}</div>
                          </div>
                          <div style={{ fontSize: 13, color: '#475569' }}>
                            {recognitionSummary.matchedNames.length} matched / {recognitionSummary.unmatchedNames.length} unmatched
                          </div>
                        </div>

                        {uploadedImageUrl ? (
                          <div className="food-meal-upload-preview">
                            <img className="food-meal-upload-preview-image" src={uploadedImageUrl} alt="Uploaded" />
                          </div>
                        ) : null}

                        {recognitionSummary.recognizedNames.length > 0 ? (
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Recognized labels</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {recognitionSummary.recognizedNames.map((name) => (
                                <span key={`recognized-${name}`} className="food-chip food-chip--neutral">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {recognitionSummary.matchedNames.length > 0 ? (
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Added to meal draft</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {recognitionSummary.matchedNames.map((name) => (
                                <span key={`matched-${name}`} className="food-chip food-chip--success">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {recognitionSummary.unmatchedNames.length > 0 ? (
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Needs manual selection</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {recognitionSummary.unmatchedNames.map((name) => (
                                <button
                                  key={`unmatched-${name}`}
                                  type="button"
                                  className="food-chip food-chip--warn food-chip--clickable"
                                  onClick={() => {
                                    setQuery(name)
                                    setSelectedCategory('all')
                                    focusSearch()
                                  }}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <input
                      ref={searchInputRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search foods in Chinese or English"
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        const first = foods[0]
                        if (!first) return
                        event.preventDefault()
                        toggleFood(first)
                      }}
                      style={{
                        width: '100%',
                        minHeight: 52,
                        borderRadius: 16,
                        border: '1px solid rgba(148, 163, 184, 0.28)',
                        padding: '0 16px'
                      }}
                    />

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {categories.map((category) => {
                        const active = selectedCategory === category
                        const emoji = category === 'all' ? '' : `${emojiForFoodCategory(category)} `
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setSelectedCategory(category)}
                            style={{
                              border: active ? '1px solid #0f766e' : '1px solid rgba(148, 163, 184, 0.24)',
                              background: active ? '#ecfeff' : '#fff',
                              color: active ? '#0f766e' : '#475569',
                              minHeight: 44,
                              padding: '0 14px',
                              borderRadius: 999,
                              fontSize: 14,
                              fontWeight: 700
                            }}
                          >
                            {category === 'all' ? 'All Categories' : `${emoji}${category}`}
                          </button>
                        )
                      })}
                    </div>

                    {recognizeHint ? (
                      <div className="food-notice food-notice--info">{recognizeHint}</div>
                    ) : null}
                    {recognizeSuccessHint ? (
                      <div className="food-notice food-notice--success">{recognizeSuccessHint}</div>
                    ) : null}
                    {error ? (
                      <div className="food-notice food-notice--error">{error}</div>
                    ) : null}
                    {loading ? <div style={{ color: '#64748b' }}>Loading foods...</div> : null}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 14
                      }}
                    >
                      {foods.map((food) => {
                        const selected = Boolean(cart[food.id])
                        const categoryEmoji = emojiForFoodCategory(food.category)
                        return (
                          <div
                            key={food.id}
                            onClick={() => toggleFood(food)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                toggleFood(food)
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            style={{
                              border: selected ? '1px solid #0f766e' : '1px solid rgba(148, 163, 184, 0.24)',
                              background: selected ? '#f0fdfa' : '#fff',
                              borderRadius: 18,
                              padding: 18,
                              textAlign: 'left',
                              display: 'grid',
                              gap: 10,
                              boxShadow: selected ? '0 12px 24px rgba(15, 118, 110, 0.08)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                              <div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{food.displayName}</div>
                              </div>
                              <div
                                style={{
                                  minWidth: 72,
                                  textAlign: 'right',
                                  color: selected ? '#0f766e' : '#94a3b8',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  letterSpacing: '0.06em'
                                }}
                              >
                                {selected ? 'SELECTED' : 'ADD'}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span className="food-chip food-chip--neutral">
                                {categoryEmoji} {food.category}
                              </span>
                              {selected ? <span className="food-chip food-chip--success">Selected</span> : null}
                            </div>
                          </div>
                        )
                      })}
                      {!loading && foods.length === 0 ? (
                        <div style={{ color: '#64748b' }}>
                          The formal food library is currently empty. Check backend seed data and `/api/foods`.
                        </div>
                      ) : null}
                    </div>

                    {foodsLoadingPage ? <div style={{ color: '#64748b', marginTop: 14 }}>Loading...</div> : null}
                    {foodsTotalPages > 1 ? (
                      <div className="food-meal-pagination">
                        <button
                          type="button"
                          className="food-meal-page-btn"
                          disabled={foodsPage <= 1 || foodsLoadingPage}
                          onClick={() => void gotoFoodsPage(foodsPage - 1)}
                        >
                          Prev
                        </button>
                        {pageNumbers.map((page) => (
                          <button
                            key={page}
                            type="button"
                            className={`food-meal-page-btn${page === foodsPage ? ' food-meal-page-btn--active' : ''}`}
                            disabled={foodsLoadingPage}
                            onClick={() => void gotoFoodsPage(page)}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="food-meal-page-btn"
                          disabled={foodsPage >= foodsTotalPages || foodsLoadingPage}
                          onClick={() => void gotoFoodsPage(foodsPage + 1)}
                        >
                          Next
                        </button>
                        <div style={{ color: '#64748b', fontSize: 13 }}>
                          Page {foodsPage} / {foodsTotalPages} · {foodsTotal} foods
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="col-xl-4 col-lg-5">
                <div className="cl_blog-widget food-meal-draft-sticky">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <h4 className="cl_blog-widget-title mb-0">Meal Draft</h4>
                    {selectedCount > 0 ? (
                      <button
                        type="button"
                        onClick={clearDraft}
                        style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontWeight: 700 }}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>

                  {selectedCount === 0 ? (
                    <div style={{ color: '#64748b', marginTop: 18 }}>
                      No food selected yet. Pick from the library or use image recognition to build the meal draft.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                      {selectedItems.map((item) => (
                        <div
                          key={item.food.id}
                          style={{
                            border: '1px solid rgba(148, 163, 184, 0.18)',
                            borderRadius: 18,
                            padding: 16,
                            background: '#fff'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.food.displayName}</div>
                              <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                                {Math.round((item.food.calories * item.grams) / 100)} kcal current serving
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFood(item.food.id)}
                              style={{ color: '#b91c1c', background: 'transparent', border: 'none', fontWeight: 700 }}
                            >
                              Remove
                            </button>
                          </div>
                          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                            <input
                              type="number"
                              min={1}
                              value={item.grams}
                              onChange={(event) => {
                                const grams = Number(event.target.value)
                                if (Number.isFinite(grams) && grams > 0) updateGrams(item.food.id, grams)
                              }}
                              ref={(el) => {
                                gramsInputRefs.current[item.food.id] = el
                              }}
                              style={{
                                width: '100%',
                                minHeight: 46,
                                borderRadius: 14,
                                border: '1px solid rgba(148, 163, 184, 0.28)',
                                padding: '0 12px'
                              }}
                            />
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {quickGramSteps.map((grams) => (
                                <button
                                  key={grams}
                                  type="button"
                                  onClick={() => updateGrams(item.food.id, grams)}
                                  style={{
                                    minHeight: 34,
                                    padding: '0 12px',
                                    borderRadius: 999,
                                    border: item.grams === grams ? '1px solid #0f766e' : '1px solid rgba(148, 163, 184, 0.22)',
                                    background: item.grams === grams ? '#ecfeff' : '#fff',
                                    color: item.grams === grams ? '#0f766e' : '#475569',
                                    fontSize: 12,
                                    fontWeight: 700
                                  }}
                                >
                                  {grams}g
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => updateGrams(item.food.id, item.grams + 25)}
                                style={{
                                  minHeight: 34,
                                  padding: '0 12px',
                                  borderRadius: 999,
                                  border: '1px solid rgba(148, 163, 184, 0.22)',
                                  background: '#fff',
                                  color: '#475569',
                                  fontSize: 12,
                                  fontWeight: 700
                                }}
                              >
                                +25g
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                    {authError ? (
                      <div className="food-notice food-notice--warn">
                        <div style={{ fontWeight: 800 }}>Login expired</div>
                        <div style={{ marginTop: 6 }}>
                          Your session is no longer valid for meal records. Re-login before saving or loading this meal.
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                          <Link to="/login" className="cl_theme-btn">
                            Go Login
                          </Link>
                          <button type="button" className="cl_theme-btn" onClick={auth.logout}>
                            Clear Session
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {successHint ? (
                      <div className="food-notice food-notice--success">
                        <div style={{ fontWeight: 800 }}>Saved</div>
                        <div style={{ marginTop: 6 }}>{successHint}</div>
                      </div>
                    ) : null}
                    {error && !authError ? (
                      <div className="food-notice food-notice--error">
                        <div style={{ fontWeight: 800 }}>Action failed</div>
                        <div style={{ marginTop: 6 }}>{error}</div>
                        {lastErrorAction === 'save' ? (
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                            <button
                              type="button"
                              className="cl_theme-btn"
                              onClick={() => void handleSave()}
                              disabled={busy || selectedCount === 0}
                            >
                              Retry Save
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="food-meal-side-metrics">
                      <div className="food-module-metric food-module-metric--calories">
                        <div className="food-module-metric-label">
                          <span className="food-module-metric-icon">🔥</span> Calories
                        </div>
                        <div className="food-module-metric-value">
                          <span className="food-module-metric-number">{formatMetricParts(totals.kcal, 'kcal').numberText}</span>
                          <span className="food-module-metric-unit">{formatMetricParts(totals.kcal, 'kcal').unitText}</span>
                        </div>
                      </div>
                      <div className="food-module-metric food-module-metric--protein">
                        <div className="food-module-metric-label">
                          <span className="food-module-metric-icon">💪</span> Protein
                        </div>
                        <div className="food-module-metric-value">
                          <span className="food-module-metric-number">{formatMetricParts(totals.protein, 'g').numberText}</span>
                          <span className="food-module-metric-unit">{formatMetricParts(totals.protein, 'g').unitText}</span>
                        </div>
                      </div>
                      <div className="food-module-metric food-module-metric--fat">
                        <div className="food-module-metric-label">
                          <span className="food-module-metric-icon">🥑</span> Fat
                        </div>
                        <div className="food-module-metric-value">
                          <span className="food-module-metric-number">{formatMetricParts(totals.fat, 'g').numberText}</span>
                          <span className="food-module-metric-unit">{formatMetricParts(totals.fat, 'g').unitText}</span>
                        </div>
                      </div>
                      <div className="food-module-metric food-module-metric--carbs">
                        <div className="food-module-metric-label">
                          <span className="food-module-metric-icon">🍚</span> Carbs
                        </div>
                        <div className="food-module-metric-value">
                          <span className="food-module-metric-number">{formatMetricParts(totals.carbs, 'g').numberText}</span>
                          <span className="food-module-metric-unit">{formatMetricParts(totals.carbs, 'g').unitText}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
                      <button
                        type="button"
                        className="cl_theme-btn"
                        onClick={() => void handleSave()}
                        disabled={busy || selectedCount === 0}
                      >
                        {busy ? 'Saving...' : 'Save Meal'}
                      </button>
                      {savedMealId ? (
                        <button
                          type="button"
                          className="cl_theme-btn"
                          onClick={() => void handleDeleteMeal()}
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
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
