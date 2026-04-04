import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../state/auth-context'

type NutritionResp = {
  food_name: string
  source: 'openfoodfacts' | 'mock'
  image_url?: string
  nutrition_per_100g: {
    calories_kcal?: number | null
    protein_g?: number | null
    fat_g?: number | null
    carbohydrates_g?: number | null
    fiber_g?: number | null
    sugar_g?: number | null
  }
}

export default function FoodPage() {
  const auth = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  const [foodName, setFoodName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<NutritionResp | null>(null)

  const [mealDate, setMealDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mealType, setMealType] = useState('午餐')
  const [quantity, setQuantity] = useState<number>(100)

  async function analyze() {
    setError(null)
    setBusy(true)
    try {
      const r = await apiFetch<NutritionResp>('/api/nutrition/analyze', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ food_name: foodName })
      })
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '分析失败')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!auth.user || !result) return
    setError(null)
    setBusy(true)
    try {
      const p = result.nutrition_per_100g
      const factor = quantity / 100
      await apiFetch('/api/diets', {
        method: 'POST',
        body: JSON.stringify({
          food_name: result.food_name,
          quantity,
          meal_type: mealType,
          meal_date: mealDate,
          calories: p.calories_kcal != null ? p.calories_kcal * factor : null,
          protein: p.protein_g != null ? p.protein_g * factor : null,
          fat: p.fat_g != null ? p.fat_g * factor : null,
          carbohydrates: p.carbohydrates_g != null ? p.carbohydrates_g * factor : null,
          fiber: p.fiber_g != null ? p.fiber_g * factor : null,
          sugar: p.sugar_g != null ? p.sugar_g * factor : null
        })
      })
      setError('已保存到饮食记录')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Food Tool</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Food</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="container">
          <div className="row">
            <div className="col-xl-7 col-lg-7">
              <div className="cl_blog-widget mb-30">
                <h4 className="cl_blog-widget-title mb-30">Image</h4>
                <div style={{ borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '16/9' as any }}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src="/assets/images/bg/h5_appointment.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                  )}
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ margin: 0 }}>
                    <span className="cl_theme-btn" style={{ cursor: 'pointer' }}>
                      Upload Image
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <span style={{ opacity: 0.85 }}>YOLOv8 检测框区域（待接入）</span>
                </div>
              </div>
            </div>

            <div className="col-xl-5 col-lg-5">
              <div className="cl_blog-widget mb-30">
                <h4 className="cl_blog-widget-title mb-30">Nutrition</h4>
                <div className="cl_blog-widget mb-30" style={{ marginBottom: 0 }}>
                  <form
                    action="#"
                    onSubmit={(e) => {
                      e.preventDefault()
                      analyze().catch(() => {})
                    }}
                  >
                    <input
                      type="text"
                      placeholder="输入食物名称（例如 banana）"
                      value={foodName}
                      onChange={(e) => setFoodName(e.target.value)}
                    />
                    <button type="submit" disabled={busy || !foodName.trim()}>
                      <i className="fa-sharp fa-light fa-magnifying-glass"></i>
                    </button>
                  </form>
                </div>

                {error ? <div style={{ marginTop: 12 }}>{error}</div> : null}

                {result ? (
                  <div style={{ marginTop: 16 }}>
                    <h6 className="sub-title mb-15">识别结果</h6>
                    <p style={{ marginBottom: 8 }}>
                      {result.food_name} <span style={{ opacity: 0.7 }}>({result.source})</span>
                    </p>
                    <h6 className="sub-title mb-15">营养信息（每100g）</h6>
                    <ul>
                      {[
                        ['热量(kcal)', result.nutrition_per_100g.calories_kcal],
                        ['蛋白质(g)', result.nutrition_per_100g.protein_g],
                        ['脂肪(g)', result.nutrition_per_100g.fat_g],
                        ['碳水(g)', result.nutrition_per_100g.carbohydrates_g],
                        ['纤维(g)', result.nutrition_per_100g.fiber_g],
                        ['糖(g)', result.nutrition_per_100g.sugar_g]
                      ].map(([k, v]) => (
                        <li key={String(k)}>
                          <a href="#" onClick={(e) => e.preventDefault()}>
                            <span>
                              <i className="fa-light fa-chevrons-right"></i>
                              {k}
                            </span>{' '}
                            ({v == null ? '—' : Number(v).toFixed(2)})
                          </a>
                        </li>
                      ))}
                    </ul>

                    <div style={{ marginTop: 18 }}>
                      <h6 className="sub-title mb-15">记录</h6>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <input type="date" value={mealDate} onChange={(e) => setMealDate(e.target.value)} />
                        <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                          {['早餐', '午餐', '晚餐', '加餐'].map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                        <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} min={0} />
                      </div>
                      {!auth.user ? (
                        <p style={{ marginTop: 12, marginBottom: 0, opacity: 0.8 }}>登录后可保存到饮食记录。</p>
                      ) : (
                        <div style={{ marginTop: 14 }}>
                          <a
                            href="#"
                            className="cl_theme-btn"
                            onClick={(e) => {
                              e.preventDefault()
                              save().catch(() => {})
                            }}
                            style={busy ? { opacity: 0.7, pointerEvents: 'none' } : undefined}
                          >
                            Save to Diets
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p style={{ marginTop: 14, marginBottom: 0, opacity: 0.85 }}>上传图片并输入食物名称后，将显示营养信息与保存入口。</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

