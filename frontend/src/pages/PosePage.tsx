import { useEffect, useRef, useState } from 'react'

export default function PosePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      const v = videoRef.current
      const stream = v?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      if (videoRef.current) videoRef.current.srcObject = stream
      setRunning(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '无法打开摄像头')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="text-sm font-semibold">摄像头</div>
          <button
            className="rounded-xl bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
            onClick={start}
          >
            {running ? '重新连接' : '开始'}
          </button>
        </div>
        <div className="relative aspect-video bg-black/40">
          <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-emerald-500/10" />
            <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-slate-200">
              MoveNet骨架绘制区域（待接入）
            </div>
          </div>
        </div>
        {error ? <div className="px-5 py-3 text-xs text-rose-300">{error}</div> : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">实时分析</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-slate-400">识别动作</div>
            <div className="mt-2 text-lg font-semibold">—</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-slate-400">实时评分</div>
            <div className="mt-2 text-lg font-semibold">0</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-slate-400">纠正建议</div>
          <div className="mt-2 text-sm text-slate-200">进入模型后在此输出如“膝盖不要超过脚尖”等提示。</div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-slate-400">历史报告（本次训练）</div>
          <div className="mt-2 text-sm text-slate-200">平均得分、总时长、估算消耗等（可后续对接保存到workout_records）。</div>
        </div>
      </div>
    </div>
  )
}

