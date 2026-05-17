import type { HTMLAttributes } from 'react'

type AppCardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: 'default' | 'soft'
}

export default function AppCard({ children, className, tone = 'default', ...rest }: AppCardProps) {
  return <div {...rest} className={['app-card', tone === 'soft' ? 'app-card--soft' : '', className].filter(Boolean).join(' ')}>{children}</div>
}

