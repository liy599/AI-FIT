import type { ReactNode } from 'react'

export function MetricCard(props: { label: ReactNode; value: string | number; unit?: string }) {
  return (
    <div className="pose-metric-card pose-metric-card-light">
      <span className="pose-metric-label pose-metric-label-light">{props.label}</span>
      <strong className="pose-metric-value pose-metric-value-light">
        {props.value}
        {props.unit ?? ''}
      </strong>
    </div>
  )
}

export function LabelWithTip(props: { label: string; tip: string }) {
  return (
    <span className="pose-inline-tip">
      <span>{props.label}</span>
      <span title={props.tip} className="pose-inline-tip-mark">
        ?
      </span>
    </span>
  )
}

export function MetricCardPlaceholder() {
  return (
    <div className="pose-metric-card pose-metric-card-light pose-metric-card-placeholder" aria-hidden="true">
      <span className="pose-metric-label pose-metric-label-light pose-placeholder-hidden">Placeholder</span>
      <strong className="pose-metric-value pose-metric-value-light pose-placeholder-hidden">0</strong>
    </div>
  )
}

