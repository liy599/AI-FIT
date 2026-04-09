import type { ButtonHTMLAttributes } from 'react'

type AppButtonVariant = 'brand' | 'neutral' | 'danger'
type AppButtonSize = 'sm' | 'md' | 'lg'

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant
  size?: AppButtonSize
  loading?: boolean
}

export default function AppButton({
  children,
  className,
  disabled,
  loading,
  type = 'button',
  variant = 'brand',
  size = 'lg',
  ...rest
}: AppButtonProps) {
  const classes = ['app-btn', `app-btn--${variant}`, `app-btn--${size}`, className].filter(Boolean).join(' ')

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
    >
      {children}
      {loading ? <span className="sr-only">Loading</span> : null}
    </button>
  )
}
