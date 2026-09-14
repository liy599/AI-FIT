import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { AuthProvider, useAuth } from './state/auth-context'
import HomePage from './pages/public/HomePage'
import FoodModulePage from './pages/food/FoodModulePage'
import FoodMealPage from './pages/food/FoodMealPage'
import CoursesListPage from './pages/courses/CoursesListPage'
import CourseDetailPage from './pages/courses/CourseDetailPage'

function lazyWithReload<T extends ComponentType<unknown>>(loader: () => Promise<{ default: T }>) {
  return lazy(() =>
    loader().catch((error) => {
      const key = 'aifitguard:chunk-reload'
      const message = error instanceof Error ? error.message : String(error)
      const isChunkError = /chunk|import|module|fetch/i.test(message)
      if (isChunkError && sessionStorage.getItem(key) !== '1') {
        sessionStorage.setItem(key, '1')
        window.location.reload()
      }
      throw error
    })
  )
}

// Lazy-load pages (code splitting for better performance)
const AboutPage = lazyWithReload(() => import('./pages/public/AboutPage'))
const AdminBlogsPage = lazyWithReload(() => import('./pages/admin/AdminBlogsPage'))
const AdminDashboardPage = lazyWithReload(() => import('./pages/admin/AdminDashboardPage'))
const AdminUsersPage = lazyWithReload(() => import('./pages/admin/AdminUsersPage'))
const BlogDetailPage = lazyWithReload(() => import('./pages/blog/BlogDetailPage'))
const BlogEditorPage = lazyWithReload(() => import('./pages/blog/BlogEditorPage'))
const BlogListPage = lazyWithReload(() => import('./pages/blog/BlogListPage'))
const LoginPage = lazyWithReload(() => import('./pages/auth/LoginPage'))
const NotFoundPage = lazyWithReload(() => import('./pages/public/NotFoundPage'))
const PoseGuidePage = lazyWithReload(() => import('./pages/pose/PoseGuidePage'))
const PoseSelectPage = lazyWithReload(() => import('./pages/pose/PoseSelectPage'))
const PoseTrainingHistoryPage = lazyWithReload(() => import('./pages/pose/PoseTrainingHistoryPage'))
const PoseTrainingReportPage = lazyWithReload(() => import('./pages/pose/PoseTrainingReportPage'))
const PoseToolPage = lazyWithReload(() => import('./pages/pose/PoseToolPage'))
const ProfileOnboardingPage = lazyWithReload(() => import('./pages/user/ProfileOnboardingPage'))
const ProfilePage = lazyWithReload(() => import('./pages/user/ProfilePage'))
const RegisterPage = lazyWithReload(() => import('./pages/auth/RegisterPage'))
const ResetPasswordPage = lazyWithReload(() => import('./pages/auth/ResetPasswordPage'))
const VerifyEmailPage = lazyWithReload(() => import('./pages/auth/VerifyEmailPage'))

// Route guard: requires user authentication
function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const loc = useLocation()

  // If user is not logged in, redirect to login page
  if (!auth.user) {
    const from = `${loc.pathname}${loc.search}${loc.hash}`
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace state={{ from }} />
  }

  return children
}

// Route guard: requires administrator permission
function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const loc = useLocation()

  // If user is not logged in, redirect to login page
  if (!auth.user) {
    const from = `${loc.pathname}${loc.search}${loc.hash}`
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace state={{ from }} />
  }

  // If user is not an admin, redirect to home page
  if (!auth.user.is_admin) return <Navigate to="/" replace />

  return children
}

type GuardMode = 'public' | 'auth' | 'admin'
type AppRoute = {
  path: string
  element: ReactNode
  guard?: GuardMode
  guestOnly?: boolean
}

// Apply route guards in a single place for consistency
function applyGuard(route: AppRoute) {
  if (route.guestOnly) return <RequireGuest>{route.element}</RequireGuest>
  if (route.guard === 'auth') return <RequireAuth>{route.element}</RequireAuth>
  if (route.guard === 'admin') return <RequireAdmin>{route.element}</RequireAdmin>
  return route.element
}

// Route guard: logged-in users should not revisit login/register pages
function RequireGuest({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.user) return <Navigate to="/profile" replace />
  return children
}

// Route registry: grouped by business module for maintainability
const coreRoutes: AppRoute[] = [
  { path: '/', element: <HomePage /> },
  { path: '/about', element: <AboutPage /> }
]

const poseRoutes: AppRoute[] = [
  { path: '/tools/pose', element: <PoseSelectPage /> },
  { path: '/tools/pose/history', element: <PoseTrainingHistoryPage />, guard: 'auth' },
  { path: '/tools/pose/:exerciseSlug', element: <PoseGuidePage /> },
  { path: '/tools/pose/:exerciseSlug/video', element: <PoseToolPage />, guard: 'auth' },
  { path: '/tools/pose/:exerciseSlug/history', element: <PoseTrainingHistoryPage />, guard: 'auth' },
  { path: '/tools/pose/:exerciseSlug/history/:sessionId', element: <PoseTrainingReportPage />, guard: 'auth' }
]

const blogRoutes: AppRoute[] = [
  { path: '/blogs', element: <BlogListPage /> },
  { path: '/blogs/new', element: <BlogEditorPage />, guard: 'auth' },
  { path: '/blogs/:id/edit', element: <BlogEditorPage />, guard: 'auth' },
  { path: '/blogs/:id', element: <BlogDetailPage /> }
]

const userRoutes: AppRoute[] = [
  { path: '/onboarding/profile', element: <ProfileOnboardingPage />, guard: 'auth' },
  { path: '/profile', element: <ProfilePage />, guard: 'auth' }
]

const learningRoutes: AppRoute[] = [
  { path: '/food', element: <FoodModulePage />, guard: 'auth' },
  { path: '/food/meal/:mealType', element: <FoodMealPage />, guard: 'auth' },
  { path: '/courses', element: <CoursesListPage />, guard: 'auth' },
  { path: '/courses/:id', element: <CourseDetailPage />, guard: 'auth' }
]

const adminRoutes: AppRoute[] = [
  { path: '/admin', element: <AdminDashboardPage />, guard: 'admin' },
  { path: '/admin/blogs', element: <AdminBlogsPage />, guard: 'admin' },
  { path: '/admin/users', element: <AdminUsersPage />, guard: 'admin' }
]

const authRoutes: AppRoute[] = [
  { path: '/login', element: <LoginPage />, guestOnly: true },
  { path: '/register', element: <RegisterPage />, guestOnly: true },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> }
]

const fallbackRoutes: AppRoute[] = [
  { path: '*', element: <NotFoundPage /> }
]

const appRoutes: AppRoute[] = [
  ...coreRoutes,
  ...poseRoutes,
  ...blogRoutes,
  ...userRoutes,
  ...learningRoutes,
  ...adminRoutes,
  ...authRoutes,
  ...fallbackRoutes
]

// Main App component
export default function App() {
  return (
    <AuthProvider>
      {/* Provides global authentication state */}

      <Layout>
        {/* Shared layout (header, footer, etc.) */}

        <Suspense fallback={<div className="page-loading">Loading...</div>}>
          {/* Shows fallback UI while lazy components are loading */}

          <Routes>
            {/* Define all application routes */}
            {appRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={applyGuard(route)} />
            ))}
          </Routes>
        </Suspense>
      </Layout>
    </AuthProvider>
  )
}
