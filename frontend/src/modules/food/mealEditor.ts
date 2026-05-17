import type { FoodItem, FoodMealType } from './index'

export type CartItem = {
  food: FoodItem
  grams: number
}

export type RecognitionSummary = {
  fileName: string
  recognizedNames: string[]
  matchedNames: string[]
  unmatchedNames: string[]
}

export const mealTitles: Record<FoodMealType, { title: string; note: string }> = {
  breakfast: {
    title: 'Breakfast',
    note: 'Start with a clean first meal and keep the morning intake visible.'
  },
  lunch: {
    title: 'Lunch',
    note: 'Build the midday meal with fast selection, image recognition, and formal save.'
  },
  dinner: {
    title: 'Dinner',
    note: 'Review evening intake with a structured draft before saving into today.'
  },
  snack: {
    title: 'Snack',
    note: 'Track add-on foods separately so the main meals stay clean.'
  }
}

export const quickGramSteps = [50, 100, 150, 200]
export const FOODS_PAGE_SIZE = 20

export function isMealType(value: string | undefined): value is FoodMealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack'
}

export function calcTotals(cart: Record<number, CartItem>) {
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

export function formatMetricParts(value: number | undefined, unit: string) {
  if (value == null) return { numberText: '--', unitText: unit }
  return { numberText: value.toFixed(1), unitText: unit }
}

export function formatMacro(value: number, unit: string) {
  return `${value.toFixed(1)} ${unit}`
}

export function emojiForFoodCategory(category: string) {
  const value = category.trim().toLowerCase()
  if (!value) return '🍽️'
  if (value.includes('western')) return '🍔'
  if (value.includes('eastern') || value.includes('chinese')) return '🥟'
  if (value.includes('fruit')) return '🍎'
  if (value.includes('veget')) return '🥬'
  if (value.includes('meat')) return '🥩'
  if (value.includes('fish') || value.includes('sea')) return '🐟'
  if (value.includes('egg')) return '🥚'
  if (value.includes('milk') || value.includes('dairy')) return '🥛'
  if (value.includes('grain') || value.includes('rice') || value.includes('bread')) return '🍚'
  if (value.includes('snack')) return '🍪'
  if (value.includes('drink') || value.includes('beverage')) return '🥤'
  if (value.includes('nut')) return '🥜'
  return '🥗'
}

export function isAuthErrorMessage(message: string | null) {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes('authorization') ||
    normalized.includes('token has expired') ||
    normalized.includes('jwt') ||
    normalized.includes('signature verification failed')
  )
}

export function mapRecognizeErrorMessage(error: unknown) {
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
