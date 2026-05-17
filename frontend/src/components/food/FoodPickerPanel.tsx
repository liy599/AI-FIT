import type { RefObject } from 'react'
import type { FoodItem } from '../../modules/food'
import { emojiForFoodCategory } from '../../modules/food/mealEditor'

type FoodPickerPanelProps = {
  searchInputRef: RefObject<HTMLInputElement>
  query: string
  categories: string[]
  selectedCategory: string
  foods: FoodItem[]
  selectedFoodIds: Set<number>
  loading: boolean
  foodsLoadingPage: boolean
  foodsTotalPages: number
  foodsPage: number
  foodsTotal: number
  pageNumbers: number[]
  onQueryChange: (next: string) => void
  onCategoryChange: (next: string) => void
  onToggleFood: (food: FoodItem) => void
  onPageChange: (nextPage: number) => void
}

export function FoodPickerPanel(props: FoodPickerPanelProps) {
  const {
    searchInputRef,
    query,
    categories,
    selectedCategory,
    foods,
    selectedFoodIds,
    loading,
    foodsLoadingPage,
    foodsTotalPages,
    foodsPage,
    foodsTotal,
    pageNumbers,
    onQueryChange,
    onCategoryChange,
    onToggleFood,
    onPageChange
  } = props

  return (
    <>
      <input
        ref={searchInputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search foods in Chinese or English"
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          const first = foods[0]
          if (!first) return
          event.preventDefault()
          onToggleFood(first)
        }}
        className="food-meal-search-input"
      />

      <div className="food-meal-category-row">
        {categories.map((category) => {
          const active = selectedCategory === category
          const emoji = category === 'all' ? '' : `${emojiForFoodCategory(category)} `
          return (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(category)}
              className={`food-meal-category-btn${active ? ' is-active' : ''}`}
            >
              {category === 'all' ? 'All Categories' : `${emoji}${category}`}
            </button>
          )
        })}
      </div>

      {loading ? <div className="food-meal-muted">Loading foods...</div> : null}

      <div className="food-meal-food-grid">
        {foods.map((food) => {
          const selected = selectedFoodIds.has(food.id)
          const categoryEmoji = emojiForFoodCategory(food.category)
          return (
            <div
              key={food.id}
              onClick={() => onToggleFood(food)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onToggleFood(food)
                }
              }}
              role="button"
              tabIndex={0}
              className={`food-meal-food-card${selected ? ' is-selected' : ''}`}
            >
              <div className="food-meal-food-head">
                <div>
                  <div className="food-meal-food-name">{food.displayName}</div>
                </div>
                <div className={`food-meal-food-state${selected ? ' is-selected' : ''}`}>
                  {selected ? 'SELECTED' : 'ADD'}
                </div>
              </div>

              <div className="food-chip-row">
                <span className="food-chip food-chip--neutral">
                  {categoryEmoji} {food.category}
                </span>
                {selected ? <span className="food-chip food-chip--success">Selected</span> : null}
              </div>
            </div>
          )
        })}
        {!loading && foods.length === 0 ? (
          <div className="food-meal-muted">
            The formal food library is currently empty. Check backend seed data and `/api/foods`.
          </div>
        ) : null}
      </div>

      {foodsLoadingPage ? <div className="food-meal-muted food-meal-muted-top">Loading...</div> : null}
      {foodsTotalPages > 1 ? (
        <div className="food-meal-pagination">
          <button
            type="button"
            className="food-meal-page-btn"
            disabled={foodsPage <= 1 || foodsLoadingPage}
            onClick={() => onPageChange(foodsPage - 1)}
          >
            Prev
          </button>
          {pageNumbers.map((page) => (
            <button
              key={page}
              type="button"
              className={`food-meal-page-btn${page === foodsPage ? ' food-meal-page-btn--active' : ''}`}
              disabled={foodsLoadingPage}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            className="food-meal-page-btn"
            disabled={foodsPage >= foodsTotalPages || foodsLoadingPage}
            onClick={() => onPageChange(foodsPage + 1)}
          >
            Next
          </button>
          <div className="food-meal-page-meta">
            Page {foodsPage} / {foodsTotalPages} / {foodsTotal} foods
          </div>
        </div>
      ) : null}
    </>
  )
}
