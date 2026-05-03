import { apiFetch, apiUpload } from '../api'
import type {
  DaySummary,
  FoodItem,
  FoodMealType,
  MealRecord,
  MealItemDraft,
  RecognizeFoodsResponse
} from './types_runtime'

type FoodsQuery = {
  q?: string
  category?: string
  limit?: number
  offset?: number
  page?: number
}

export type FoodsPage = {
  items: FoodItem[]
  total: number
  limit: number
  offset: number
  page: number
}

export function getFoodModuleMeta() {
  return apiFetch<{
    module: string
    status: string
    phase: string
    endpoints: string[]
    notes: string[]
  }>('/api/food/meta')
}

export function getFoods(query: FoodsQuery = {}) {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.category) params.set('category', query.category)
  if (query.limit != null) params.set('limit', String(query.limit))
  if (query.offset != null) params.set('offset', String(query.offset))
  if (query.page != null) params.set('page', String(query.page))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiFetch<FoodItem[]>(`/api/foods${suffix}`)
}

export function getFoodCategories() {
  return apiFetch<string[]>('/api/foods/categories', { auth: false })
}

export function getFoodsPage(query: FoodsQuery = {}) {
  const params = new URLSearchParams()
  params.set('paged', '1')
  if (query.q) params.set('q', query.q)
  if (query.category) params.set('category', query.category)
  if (query.limit != null) params.set('limit', String(query.limit))
  if (query.offset != null) params.set('offset', String(query.offset))
  if (query.page != null) params.set('page', String(query.page))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiFetch<FoodsPage | FoodItem[]>(`/api/foods${suffix}`).then((data) => {
    if (Array.isArray(data)) {
      const limit = query.limit ?? (data.length || 1)
      const page = query.page ?? 1
      const offset = query.offset ?? (page - 1) * limit
      return {
        items: data,
        total: offset + data.length,
        limit,
        offset,
        page
      }
    }
    return data
  })
}

export function getFoodsBulk(ids: number[]) {
  return apiFetch<FoodItem[]>('/api/foods/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids })
  })
}

export function getMeal(mealId: number) {
  return apiFetch<MealRecord>(`/api/meals/${mealId}`)
}

export function getTodaySummary(date?: string) {
  const suffix = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiFetch<DaySummary>(`/api/meals/today${suffix}`)
}

export function saveMeal(mealType: FoodMealType, items: MealItemDraft[], recordedOn?: string) {
  return apiFetch<MealRecord>('/api/meals', {
    method: 'POST',
    body: JSON.stringify({
      mealType,
      items,
      ...(recordedOn ? { recordedOn } : {})
    })
  })
}

export function deleteMeal(mealId: number) {
  return apiFetch<void>(`/api/meals/${mealId}`, {
    method: 'DELETE'
  })
}

export async function recognizeFoods(file: File) {
  const form = new FormData()
  form.append('image', file)
  return apiUpload<RecognizeFoodsResponse>('/api/recognize', form, {
    auth: false
  })
}

