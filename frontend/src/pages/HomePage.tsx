import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../state/auth-context'

type BlogCard = {
  id: number
  title: string
  cover_image_url: string | null
  excerpt: string
  author: { id: number; username: string }
  created_at: string
  tags: { id: number; name: string }[]
}

type CourseCard = {
  id: number
  title: string
  cover_image_url: string | null
  instructor_name: string
  is_free: boolean
  price: number | null
  avg_rating: number | null
  enroll_count: number
}

export default function HomePage() {
  const auth = useAuth()
  const [blogs, setBlogs] = useState<BlogCard[]>([])
  const [courses, setCourses] = useState<CourseCard[]>([])

  useEffect(() => {
    let cancelled = false
    apiFetch<{ items: BlogCard[] }>('/api/blogs?page=1&page_size=8', { auth: false })
      .then((r) => {
        if (cancelled) return
        setBlogs(r.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!auth.user) return
    let cancelled = false
    apiFetch<{ items: CourseCard[] }>('/api/courses?page=1&page_size=4&sort=hot')
      .then((r) => {
        if (cancelled) return
        setCourses(r.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [auth.user])

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative">
          <div className="text-xs font-medium tracking-widest text-slate-300">AI FITGUARD</div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            更聪明的训练，更清晰的饮食，
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
              {' '}
              更稳的进步
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-300 md:text-base">
            以隐私优先为原则，在浏览器端运行AI模型，结合社区博客与课程体系，打造你的个性化健身路径。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/tools/pose"
              className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-medium text-white shadow-glow hover:bg-indigo-400"
            >
              开始动作矫正
            </Link>
            <Link
              to="/tools/food"
              className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              开始食物分析
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-0.5 hover:bg-white/10">
          <div className="text-sm font-semibold">动作矫正（页面版）</div>
          <div className="mt-2 text-sm text-slate-300">
            左侧视频 + 右侧实时反馈，预留MoveNet骨架绘制与评分区域。
          </div>
          <Link to="/tools/pose" className="mt-4 inline-block text-sm text-indigo-300 hover:text-indigo-200">
            进入 →
          </Link>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-0.5 hover:bg-white/10">
          <div className="text-sm font-semibold">食物热量评估（页面版）</div>
          <div className="mt-2 text-sm text-slate-300">
            左侧上传/拍照 + 右侧营养面板，预留YOLOv8检测框与记录按钮。
          </div>
          <Link to="/tools/food" className="mt-4 inline-block text-sm text-emerald-300 hover:text-emerald-200">
            进入 →
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">最新博客</h2>
          <Link to="/blogs" className="text-sm text-slate-300 hover:text-white">
            查看全部 →
          </Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {blogs.map((b) => (
            <Link
              key={b.id}
              to={`/blogs/${b.id}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              <div className="h-28 bg-gradient-to-br from-indigo-500/20 via-sky-500/10 to-emerald-500/20" />
              <div className="p-4">
                <div className="line-clamp-2 text-sm font-semibold group-hover:text-white">{b.title}</div>
                <div className="mt-2 line-clamp-2 text-xs text-slate-400">{b.excerpt}</div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {b.tags.slice(0, 2).map((t) => (
                    <span key={t.id} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-slate-300">
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
          {blogs.length === 0 ? <div className="text-sm text-slate-400">暂无博客（先创建并发布一篇试试）</div> : null}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">精品课程推荐</h2>
          {auth.user ? (
            <Link to="/courses" className="text-sm text-slate-300 hover:text-white">
              进入课程 →
            </Link>
          ) : null}
        </div>
        {!auth.user ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            登录后查看精品课程与报名功能。
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {courses.map((c) => (
              <Link
                key={c.id}
                to={`/courses/${c.id}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                <div className="text-sm font-semibold">{c.title}</div>
                <div className="mt-2 text-xs text-slate-400">讲师：{c.instructor_name}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                  <div>{c.is_free ? '免费' : `€${c.price ?? '-'}`}</div>
                  <div>{c.avg_rating ? c.avg_rating.toFixed(1) : '-'}★</div>
                </div>
              </Link>
            ))}
            {courses.length === 0 ? <div className="text-sm text-slate-400">暂无课程（可在数据库先插入几条种子数据）</div> : null}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { k: '训练次数', v: '1,248+' },
          { k: '累计课程报名', v: '642+' },
          { k: '社区互动', v: '3,910+' }
        ].map((x) => (
          <div key={x.k} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="text-2xl font-semibold">{x.v}</div>
            <div className="mt-1 text-xs text-slate-400">{x.k}</div>
          </div>
        ))}
      </section>
    </div>
  )
}

