'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

export type WheelNavSector = {
  id: string
  metricLabel: string
  metricValue: string
  actionLabel: string
  href: string
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

function angleFromTopClockwiseDeg(x: number, y: number) {
  const rad = Math.atan2(y, x)
  const degFromRight = (rad * 180) / Math.PI
  const degFromTop = degFromRight + 90
  const norm = ((degFromTop % 360) + 360) % 360
  return norm
}

export default function WheelNav(props: {
  title: string
  subtitle: string
  sectors: [WheelNavSector, WheelNavSector, WheelNavSector]
  defaultActiveId?: string
}) {
  const router = useRouter()
  const diskRef = useRef<HTMLButtonElement | null>(null)
  const sectorCount = props.sectors.length
  const sectorAngle = 360 / sectorCount

  const initialIndex = useMemo(() => {
    const idx = props.defaultActiveId ? props.sectors.findIndex((s) => s.id === props.defaultActiveId) : -1
    return idx >= 0 ? idx : 0
  }, [props.defaultActiveId, props.sectors])

  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [rotationDeg, setRotationDeg] = useState(160)
  const [pulseKey, setPulseKey] = useState(0)

  useEffect(() => {
    const target = -(activeIndex * sectorAngle + sectorAngle / 2)
    setRotationDeg(target)
  }, [activeIndex, sectorAngle])

  function goTo(index: number) {
    const next = ((index % sectorCount) + sectorCount) % sectorCount
    setPulseKey((x) => x + 1)
    setActiveIndex(next)

    const reduced = prefersReducedMotion()
    if (reduced) {
      router.push(props.sectors[next].href)
      return
    }

    window.setTimeout(() => {
      router.push(props.sectors[next].href)
    }, 180)
  }

  function onPointerUp(e: React.PointerEvent) {
    const el = diskRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const r = Math.sqrt(dx * dx + dy * dy)
    const outerR = rect.width / 2
    const innerR = outerR * 0.22

    const t = clamp01((r - innerR) / (outerR - innerR))
    if (t <= 0) return

    const ang = angleFromTopClockwiseDeg(dx, dy)
    const idx = Math.floor(ang / sectorAngle)
    goTo(idx)
  }

  function onDiskKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      goTo(activeIndex)
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(activeIndex + 1)
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(activeIndex - 1)
      return
    }
  }

  const labelRadiusPx = 0.34

  return (
    <div className="wheel" style={{ ['--wheel-rot' as never]: `${rotationDeg}deg` }}>
      <div className="wheelDiskWrap">
        <div key={pulseKey} className="wheelPointer" aria-hidden="true" />
        <button
          ref={diskRef}
          type="button"
          className="wheelDisk"
          onPointerUp={onPointerUp}
          onKeyDown={onDiskKeyDown}
          aria-label="Wheel navigation"
        />
        <div className="wheelCenter" aria-hidden="true">
          <div className="wheelCenterTitle">{props.title}</div>
          <div className="wheelCenterSub">{props.subtitle}</div>
        </div>

        {props.sectors.map((s, idx) => {
          const a = `${idx * sectorAngle + sectorAngle / 2}deg`
          const active = idx === activeIndex
          return (
            <button
              key={s.id}
              type="button"
              className={`wheelLabel${active ? ' wheelLabelActive' : ''}`}
              onClick={() => goTo(idx)}
              style={
                {
                  ['--label-angle' as never]: a,
                  ['--label-radius' as never]: `calc(var(--wheel-size) * ${labelRadiusPx})`
                } as CSSProperties
              }
            >
              <div className="wheelLabelTop">{s.metricLabel}</div>
              <div className="wheelLabelValue">{s.metricValue}</div>
              <div className="wheelLabelAction">{s.actionLabel}</div>
            </button>
          )
        })}
      </div>

      <div className="wheelLegend" aria-label="Quick links">
        {props.sectors.map((s, idx) => (
          <button key={s.id} type="button" className={`btn btnGhost${idx === activeIndex ? ' wheelLegendActive' : ''}`} onClick={() => goTo(idx)}>
            {s.actionLabel}
          </button>
        ))}
      </div>
    </div>
  )
}
