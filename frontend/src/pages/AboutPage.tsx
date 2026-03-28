import { useMemo, useState } from 'react'

type Member = {
  name: string
  role: string
  bio: string
  details: string
}

export default function AboutPage() {
  const members = useMemo<Member[]>(
    () => [
      {
        name: '成员 A',
        role: '全栈 / 架构',
        bio: '负责系统架构、API与部署。',
        details: '负责后端API设计、数据库建模、Docker部署与整体技术方案落地。'
      },
      {
        name: '成员 B',
        role: '前端 / 交互',
        bio: '负责整体UI与动效。',
        details: '负责导航、动效、全局组件与页面可用性，确保华丽但不喧宾夺主。'
      },
      {
        name: '成员 C',
        role: 'AI / 视觉',
        bio: '负责姿态与食物识别探索。',
        details: '负责TF.js模型调研与前端推理方案评估（MoveNet/YOLOv8）。'
      },
      {
        name: '成员 D',
        role: '数据 / 测试',
        bio: '负责测试与数据可视化。',
        details: '负责统计报告逻辑、接口验证与测试覆盖率提升。'
      },
      {
        name: '成员 E',
        role: '内容 / 运营',
        bio: '负责博客内容与标签体系。',
        details: '负责博客标签策略、内容模板与社区交互体验。'
      },
      {
        name: '成员 F',
        role: '产品 / 需求',
        bio: '负责需求梳理与验收。',
        details: '负责需求拆解、验收标准与用户流程优化。'
      }
    ],
    []
  )

  const [active, setActive] = useState<Member | null>(null)

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-semibold">About AI FitGuard</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">
          AI FitGuard 的愿景是让每个人在无需专业硬件的情况下，也能获得可靠的训练指导与饮食分析。平台以“隐私优先”为原则，
          将视频/图像推理尽可能放在浏览器本地完成，并用社区与课程体系帮助用户持续进步。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">团队成员</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <button
              key={m.name}
              className="text-left rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-0.5 hover:bg-white/10"
              onClick={() => setActive(m)}
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-emerald-500/30" />
                <div>
                  <div className="text-sm font-semibold">{m.name}</div>
                  <div className="text-xs text-slate-400">{m.role}</div>
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-300">{m.bio}</div>
            </button>
          ))}
        </div>
      </section>

      {active ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setActive(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-slate-950/90 p-6 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">{active.name}</div>
                <div className="text-xs text-slate-400">{active.role}</div>
              </div>
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                onClick={() => setActive(null)}
              >
                关闭
              </button>
            </div>
            <div className="mt-4 text-sm text-slate-300">{active.details}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

