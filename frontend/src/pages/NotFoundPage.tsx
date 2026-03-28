import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
      <div className="text-2xl font-semibold">404</div>
      <div className="mt-2 text-sm text-slate-300">页面不存在</div>
      <Link
        to="/"
        className="mt-6 inline-block rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
      >
        回到首页
      </Link>
    </div>
  )
}

