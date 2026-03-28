import { useMemo, useState } from 'react'
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="text-sm font-semibold">图像识别</div>
          <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10">
            上传图片
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="relative aspect-video bg-black/40">
          {previewUrl ? <img src={previewUrl} className="h-full w-full object-cover" /> : null}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-indigo-500/10" />
            <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-slate-200">
              YOLOv8检测框区域（待接入）
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">营养分析</div>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            placeholder="输入食物名称（例如 banana）"
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
          />
          <button
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
            disabled={busy || !foodName.trim()}
            onClick={analyze}
          >
            分析
          </button>
        </div>

        {error ? <div className="mt-2 text-xs text-slate-200">{error}</div> : null}

        {result ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-slate-400">识别结果</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm font-semibold">{result.food_name}</div>
                <div className="text-xs text-slate-400">{result.source}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-slate-400">营养信息（每100g）</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {[
                  ['热量(kcal)', result.nutrition_per_100g.calories_kcal],
                  ['蛋白质(g)', result.nutrition_per_100g.protein_g],
                  ['脂肪(g)', result.nutrition_per_100g.fat_g],
                  ['碳水(g)', result.nutrition_per_100g.carbohydrates_g],
                  ['纤维(g)', result.nutrition_per_100g.fiber_g],
                  ['糖(g)', result.nutrition_per_100g.sugar_g]
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-xl border border-white/10 bg-slate-950 p-3">
                    <div className="text-xs text-slate-400">{k}</div>
                    <div className="mt-1 text-sm font-semibold">{v == null ? '—' : Number(v).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-slate-400">记录</div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <input
                  type="date"
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  value={mealDate}
                  onChange={(e) => setMealDate(e.target.value)}
                />
                <select
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                >
                  {['早餐', '午餐', '晚餐', '加餐'].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min={0}
                />
              </div>
              {!auth.user ? (
                <div className="mt-3 text-xs text-slate-400">登录后可保存到饮食记录。</div>
              ) : (
                <button
                  className="mt-3 w-full rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                  disabled={busy}
                  onClick={save}
                >
                  一键保存到饮食记录
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-300">上传图片后可在此展示检测结果、营养信息与保存入口。</div>
        )}
      </div>
    </div>
  )
}

