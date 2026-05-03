export type FoodCategory =
  | '\u4e3b\u98df'
  | '\u852c\u679c'
  | '\u8089\u86cb\u5976'
  | '\u8c46\u7c7b\u575a\u679c'
  | '\u4e2d\u5f0f\u83dc\u80b4'
  | '\u897f\u5f0f\u83dc\u80b4'
  | '\u96f6\u98df'
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

