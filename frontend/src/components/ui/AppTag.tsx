import { createElement } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'

type AppTagButtonProps = {
  as: 'button'
  active?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

type AppTagSpanProps = {
  as?: 'span'
  active?: boolean
} & HTMLAttributes<HTMLSpanElement>

type AppTagProps = AppTagButtonProps | AppTagSpanProps

export default function AppTag(props: AppTagProps) {
  const { active, className, children, as = 'span', ...rest } = props as AppTagProps & { as: 'button' | 'span' }
  const classes = ['app-tag', active ? 'app-tag--active' : '', className].filter(Boolean).join(' ')
  if (as === 'button') {
    const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>
    return createElement('button', { ...buttonProps, type: buttonProps.type ?? 'button', className: classes }, children)
  }
  return createElement('span', { ...(rest as HTMLAttributes<HTMLSpanElement>), className: classes }, children)
}

