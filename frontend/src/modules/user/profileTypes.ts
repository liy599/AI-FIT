export type UserProfile = {
  id: number
  username: string
  email: string
  avatar_url: string | null
  gender: string | null
  height: number | null
  weight: number | null
  fitness_goal: string | null
  created_at: string
  updated_at: string
}

export type MealHistory = {
  id: number
  mealType: string
  recordedOn: string
  items: Array<{
    id: number
    grams: number
    foodId: number
    food: {
      id: number
      displayName: string
      name: string
    } | null
  }>
  totals: {
    kcal: number
    protein: number
    fat: number
    carbs: number
  }
}

export type MyBlog = {
  id: number
  title: string
  cover_image_url: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

export type MyComment = {
  id: number
  blog_id: number
  content: string
  created_at: string
}

export type ProfileEditState = {
  username: string
  gender: string
  height: string
  weight: string
  fitness_goal: string
}
