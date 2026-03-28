import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth-context'

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'text-sm font-medium transition',
    isActive ? 'text-white' : 'text-slate-300 hover:text-white'
  ].join(' ')
}

export default function Navbar() {
  const auth = useAuth()
  const nav = useNavigate()

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500 shadow-glow" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">AI FitGuard</div>
            <div className="text-xs text-slate-400">你的私人AI健身教练</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/" className={navClass}>
            Home
          </NavLink>
          <NavLink to="/tools/pose" className={navClass}>
            Pose
          </NavLink>
          <NavLink to="/tools/food" className={navClass}>
            Food
          </NavLink>
          <NavLink to="/blogs" className={navClass}>
            Blog
          </NavLink>
          <NavLink to="/courses" className={navClass}>
            Courses
          </NavLink>
          <NavLink to="/about" className={navClass}>
            About
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          {auth.user ? (
            <>
              <NavLink
                to="/profile"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
              >
                {auth.user.username}
              </NavLink>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
                onClick={() => {
                  auth.logout()
                  nav('/')
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
              >
                Login
              </NavLink>
              <NavLink
                to="/register"
                className="rounded-full bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white shadow-glow hover:bg-indigo-400"
              >
                Register
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

