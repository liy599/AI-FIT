export type FoodMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type FoodItem = {
  id: number
  name: string
  displayName: string
  imageUrl?: string | null
  category: string
  aliases: string[]
  calories: number
  protein: number
  fat: number
  carbs: number
}
export type MealRecord = {
  id: number
  mealType: FoodMealType
  recordedOn: string
  items: Array<{ id: number; foodId: number; grams: number; food: FoodItem | null }>
  totals: { kcal: number; protein: number; fat: number; carbs: number }
}
export type DaySummary = {
  date: string
  meals: MealRecord[]
  totals: { kcal: number; protein: number; fat: number; carbs: number }
}
