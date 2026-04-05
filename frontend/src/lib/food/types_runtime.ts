export type FoodCategory =
  | '主食'
  | '蔬果'
  | '肉蛋奶'
  | '豆类坚果'
  | '中式菜肴'
  | '西式菜肴'
  | '零食'
  | string

export type FoodMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type FoodItem = {
  id: number
  name: string
  displayName: string
  category: FoodCategory
  aliases: string[]
  calories: number
  protein: number
  fat: number
  carbs: number
}

export type MealItemDraft = {
  foodId: number
  grams: number
}

export type MealItemDetail = MealItemDraft & {
  id: number
  food: FoodItem | null
}

export type MealRecord = {
  id: number
  mealType: FoodMealType
  recordedOn: string
  items: MealItemDetail[]
  totals: {
    kcal: number
    carbs: number
    protein: number
    fat: number
  }
}

export type DaySummary = {
  date: string
  meals: MealRecord[]
  totals: {
    kcal: number
    carbs: number
    protein: number
    fat: number
  }
}

export type RecognizeFoodsResponse = {
  names: string[]
  foodIds: number[]
  unmatchedNames: string[]
}
