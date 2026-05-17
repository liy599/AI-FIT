import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  deleteMeal,
  getFoodCategories,
  getFoodsBulk,
  getFoodsPage,
  getTodaySummary,
  recognizeFoods,
  saveMeal,
  type FoodItem,
} from '../../modules/food'
import {
  calcTotals,
  FOODS_PAGE_SIZE,
  isAuthErrorMessage,
  isMealType,
  mapRecognizeErrorMessage,
  mealTitles,
  type CartItem,
  type RecognitionSummary
} from '../../modules/food/mealEditor'
import { useAuth } from '../../state/auth-context'
import { FoodRecognitionPanel } from '../../components/food/FoodRecognitionPanel'
import { FoodPickerPanel } from '../../components/food/FoodPickerPanel'
import { MealDraftPanel } from '../../components/food/MealDraftPanel'
import '../../styles/food-module.css'

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
  const mealHeroClass = `food-meal-hero food-meal-hero--${mealType}`

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
        <section className="cl_breadcrumb-area brand-page-theme">
          <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
            <div className="page-container">
              <div className="page-row-center">
                <div className="page-col-breadcrumb">
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

        <section className="food-meal-section brand-page-body">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-food-editor">
                <div className="cl_blog-widget">
                  <h4 className="cl_blog-widget-title section-title-compact">Route Not Supported</h4>
                  <p className="section-muted-note">
                    This meal route is not part of the formal food flow. Use breakfast, lunch, dinner, or snack.
                  </p>
                  <div className="section-actions-row">
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
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
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

      <section className="food-meal-section brand-page-body">
        <div className="page-container">
          {!auth.user ? (
            <div className="page-row-center">
              <div className="page-col-food-editor">
                <div className="cl_blog-widget">
                  <h4 className="cl_blog-widget-title section-title-compact">{meal.title} Editor</h4>
                  <p className="section-muted-note">
                    Meal records are now bound to the formal AI-FIT account. Login first to continue.
                  </p>
                  <Link to="/login" className="cl_theme-btn">
                    Go Login
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="food-meal-main-grid">
              <div className="food-meal-main-primary">
                <div className={`cl_blog-widget section-widget ${mealHeroClass}`}>
                  <div className="food-meal-hero-row">
                    <div className="food-meal-hero-content">
                      <div className="food-meal-hero-kicker">
                        Formal Meal Editor
                      </div>
                      <h3 className="food-meal-hero-title">
                        {meal.title}
                      </h3>
                      <p className="food-meal-hero-note">{meal.note}</p>
                    </div>
                  </div>
                </div>

                <div className="cl_blog-widget section-widget">
                  <div className="food-meal-head-row">
                    <div>
                      <h4 className="cl_blog-widget-title section-title-tight">Select Foods</h4>
                      <p className="food-meal-subnote">
                        Search the formal food library, filter by category, or add foods from image recognition.
                      </p>
                    </div>
                  </div>

                  <div className="food-meal-editor-stack">
                    <FoodRecognitionPanel
                      fileInputRef={fileInputRef}
                      recognizing={recognizing}
                      recognitionSummary={recognitionSummary}
                      uploadedImageUrl={uploadedImageUrl}
                      onRecognize={(file) => void handleRecognize(file)}
                      onSearchUnmatched={(name) => {
                        setQuery(name)
                        setSelectedCategory('all')
                        focusSearch()
                      }}
                    />

                    <FoodPickerPanel
                      searchInputRef={searchInputRef}
                      query={query}
                      categories={categories}
                      selectedCategory={selectedCategory}
                      foods={foods}
                      selectedFoodIds={new Set(Object.keys(cart).map(Number))}
                      loading={loading}
                      foodsLoadingPage={foodsLoadingPage}
                      foodsTotalPages={foodsTotalPages}
                      foodsPage={foodsPage}
                      foodsTotal={foodsTotal}
                      pageNumbers={pageNumbers}
                      onQueryChange={setQuery}
                      onCategoryChange={setSelectedCategory}
                      onToggleFood={toggleFood}
                      onPageChange={(page) => void gotoFoodsPage(page)}
                    />

                    {recognizeHint ? (
                      <div className="food-notice food-notice--info">{recognizeHint}</div>
                    ) : null}
                    {recognizeSuccessHint ? (
                      <div className="food-notice food-notice--success">{recognizeSuccessHint}</div>
                    ) : null}
                    {error ? (
                      <div className="food-notice food-notice--error">{error}</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="food-meal-main-aside">
                <MealDraftPanel
                  selectedItems={selectedItems}
                  selectedCount={selectedCount}
                  totals={totals}
                  gramsInputRefs={gramsInputRefs}
                  authError={authError}
                  successHint={successHint}
                  error={error}
                  lastErrorAction={lastErrorAction}
                  busy={busy}
                  savedMealId={savedMealId}
                  onClearDraft={clearDraft}
                  onRemoveFood={removeFood}
                  onUpdateGrams={updateGrams}
                  onSave={() => void handleSave()}
                  onDeleteMeal={() => void handleDeleteMeal()}
                  onLogout={auth.logout}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}








