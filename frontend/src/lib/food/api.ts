import { apiFetch, apiUpload } from '../api'
import type { DaySummary, FoodItem, FoodMealType, MealRecord } from './types_runtime'

export function getFoods() { return apiFetch<FoodItem[]>('/api/foods', { auth: false }) }
export function getFoodsBulk(ids: number[]) {
  return apiFetch<FoodItem[]>('/api/foods/bulk', { method: 'POST', auth: false, body: JSON.stringify({ ids }) })
}
export function getTodaySummary(date?: string) {
  return apiFetch<DaySummary>(`/api/meals/today${date ? `?date=${encodeURIComponent(date)}` : ''}`)
}
export function saveMeal(mealType: FoodMealType, items: Array<{ foodId: number; grams: number }>) {
  return apiFetch<MealRecord>('/api/meals', { method: 'POST', body: JSON.stringify({ mealType, items }) })
}
export function deleteMeal(id: number) { return apiFetch<{ ok: boolean }>(`/api/meals/${id}`, { method: 'DELETE' }) }
export interface RecognizedMatch {
  foodId: number
  estimatedGrams: number | null
  confidence: number | null
}
export function recognizeFoods(file: File) {
  const form = new FormData()
  form.append('image', file)
  return apiUpload<{ matched: RecognizedMatch[]; unmatchedNames: string[] }>('/api/recognize', form)
}
