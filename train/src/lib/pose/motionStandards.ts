import type { MotionStandard } from './motionCompare'

export const SQUAT_SIDE_LANDING_STANDARD_V1: MotionStandard = {
  id: 'squat_side_landing_v1',
  name: '深蹲（侧面落地）',
  minQuality: 0.38,
  scoring: { distanceScale: 28 },
  phases: [
    {
      id: 'up',
      label: '站立准备',
      entry: { op: 'gte', metric: 'kneeAvgDeg', value: 155 },
      exit: { op: 'lte', metric: 'kneeAvgDeg', value: 150 },
      targets: [
        {
          id: 'up_torso',
          label: '站立躯干角',
          weight: 1,
          rule: { op: 'between', metric: 'torsoInclineAbsDeg', min: 0, max: 22 },
          cueIncrease: '胸部抬起，保持脊柱中立。',
          cueDecrease: '减少过度后仰，保持核心稳定。'
        },
        {
          id: 'up_hip',
          label: '站立髋角',
          weight: 1,
          rule: { op: 'gte', metric: 'hipAvgDeg', value: 150 },
          cueIncrease: '完全站起，伸髋到位。',
          cueDecrease: '避免过度顶髋，保持自然站姿。'
        }
      ]
    },
    {
      id: 'descent',
      label: '下蹲',
      entry: { op: 'lte', metric: 'kneeAvgDeg', value: 150 },
      exit: { op: 'lte', metric: 'kneeAvgDeg', value: 105 },
      targets: [
        {
          id: 'descent_torso',
          label: '下蹲躯干角',
          weight: 1.2,
          rule: { op: 'between', metric: 'torsoInclineAbsDeg', min: 8, max: 35 },
          cueIncrease: '适度前倾，髋部向后坐。',
          cueDecrease: '前倾过大，收紧核心并抬胸。'
        },
        {
          id: 'descent_knee',
          label: '下蹲膝角',
          weight: 1,
          rule: { op: 'between', metric: 'kneeAvgDeg', min: 95, max: 150 },
          cueIncrease: '继续下蹲，增加屈膝深度。',
          cueDecrease: '下降过快或过深，控制速度。'
        }
      ]
    },
    {
      id: 'bottom',
      label: '底部',
      entry: { op: 'lte', metric: 'kneeAvgDeg', value: 105 },
      exit: { op: 'gte', metric: 'kneeAvgDeg', value: 112 },
      targets: [
        {
          id: 'bottom_depth',
          label: '底部深度',
          weight: 1.3,
          rule: { op: 'between', metric: 'kneeAvgDeg', min: 80, max: 110 },
          cueIncrease: '深度略浅，可再下蹲一点。',
          cueDecrease: '深度过大，先保证稳定再追求更深。'
        },
        {
          id: 'bottom_torso',
          label: '底部躯干稳定',
          weight: 1,
          rule: { op: 'between', metric: 'torsoInclineAbsDeg', min: 10, max: 38 },
          cueIncrease: '可适度前倾保持平衡。',
          cueDecrease: '躯干前倾过多，核心再收紧。'
        },
        {
          id: 'bottom_stability',
          label: '底部稳定性',
          weight: 1.1,
          rule: { op: 'gte', metric: 'stabilityScore', value: 70 },
          cueIncrease: '底部保持停顿并收紧核心，减少重心晃动。',
          cueDecrease: '稳定性良好，继续保持控制。'
        }
      ]
    },
    {
      id: 'ascent',
      label: '起立',
      entry: { op: 'gte', metric: 'kneeAvgDeg', value: 112 },
      exit: { op: 'gte', metric: 'kneeAvgDeg', value: 158 },
      targets: [
        {
          id: 'ascent_torso',
          label: '起立躯干角',
          weight: 1.2,
          rule: { op: 'between', metric: 'torsoInclineAbsDeg', min: 5, max: 30 },
          cueIncrease: '保持胸部打开，稳定上升。',
          cueDecrease: '避免耸肩含胸，抬胸收核心。'
        },
        {
          id: 'ascent_knee',
          label: '起立伸膝',
          weight: 1,
          rule: { op: 'gte', metric: 'kneeAvgDeg', value: 140 },
          cueIncrease: '继续发力伸膝伸髋到站直。',
          cueDecrease: '动作已足够，控制节奏避免锁死。'
        }
      ]
    }
  ]
}

export const SQUAT_SIDE_STANDARD_V1 = SQUAT_SIDE_LANDING_STANDARD_V1
