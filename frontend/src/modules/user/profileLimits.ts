export const HEIGHT_MIN_CM = 100
export const HEIGHT_MAX_CM = 250
export const WEIGHT_MIN_KG = 30
export const WEIGHT_MAX_KG = 250

export function validateHeightCm(value: string) {
  const text = value.trim()
  if (!text) return { value: null, error: null }
  const num = Number(text)
  if (!Number.isFinite(num) || num < HEIGHT_MIN_CM || num > HEIGHT_MAX_CM) {
    return { value: null, error: `Height must be ${HEIGHT_MIN_CM}-${HEIGHT_MAX_CM} cm, e.g. 175.` }
  }
  return { value: num, error: null }
}

export function validateWeightKg(value: string) {
  const text = value.trim()
  if (!text) return { value: null, error: null }
  const num = Number(text)
  if (!Number.isFinite(num) || num < WEIGHT_MIN_KG || num > WEIGHT_MAX_KG) {
    return { value: null, error: `Weight must be ${WEIGHT_MIN_KG}-${WEIGHT_MAX_KG} kg, e.g. 70.` }
  }
  return { value: num, error: null }
}
