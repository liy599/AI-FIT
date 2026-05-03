import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './state/auth-context'
import HomePage from './pages/HomePage'

// Lazy-load pages (code splitting for better performance)
const AboutPage = lazy(() => import('./pages/AboutPage'))
const AdminDataLifecyclePage = lazy(() => import('./pages/AdminDataLifecyclePage'))
const BlogDetailPage = lazy(() => import('./pages/BlogDetailPage'))
const BlogListPage = lazy(() => import('./pages/BlogListPage'))
const FoodMealPage = lazy(() => import('./pages/FoodMealPage'))
const FoodModulePage = lazy(() => import('./pages/FoodModulePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const PoseGuidePage = lazy(() => import('./pages/PoseGuidePage'))
const PoseSelectPage = lazy(() => import('./pages/PoseSelectPage'))
const PoseTrainingHistoryPage = lazy(() => import('./pages/PoseTrainingHistoryPage'))
const PoseTrainingReportPage = lazy(() => import('./pages/PoseTrainingReportPage'))
const PoseToolPage = lazy(() => import('./pages/PoseToolPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const UserPrivacyPage = lazy(() => import('./pages/UserPrivacyPage'))

// Route guard: requires user authentication
function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const loc = useLocation()

  // If user is not logged in, redirect to login page
  if (!auth.user) {
    const from = `${loc.pathname}${loc.search}${loc.hash}`
    return <Navigate to="/login" replace state={{ from }} />
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
    return <Navigate to="/login" replace state={{ from }} />
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
}

// Apply route guards in a single place for consistency
function applyGuard(route: AppRoute) {
  if (route.guard === 'auth') return <RequireAuth>{route.element}</RequireAuth>
  if (route.guard === 'admin') return <RequireAdmin>{route.element}</RequireAdmin>
  return route.element
}

// Route registry: grouped by business module for maintainability
const coreRoutes: AppRoute[] = [
  { path: '/', element: <HomePage /> },
  { path: '/about', element: <AboutPage /> }
]

const foodRoutes: AppRoute[] = [
  { path: '/food', element: <FoodModulePage /> },
  { path: '/food/meal/:mealType', element: <FoodMealPage /> }
]

const poseRoutes: AppRoute[] = [
  { path: '/tools/pose', element: <PoseSelectPage /> },
  { path: '/tools/pose/:exerciseSlug', element: <PoseGuidePage /> },
  { path: '/tools/pose/:exerciseSlug/live', element: <PoseToolPage /> },
  { path: '/tools/pose/:exerciseSlug/video', element: <PoseToolPage /> },
  { path: '/tools/pose/:exerciseSlug/history', element: <PoseTrainingHistoryPage />, guard: 'auth' },
  { path: '/tools/pose/:exerciseSlug/history/:sessionId', element: <PoseTrainingReportPage />, guard: 'auth' }
]

const blogRoutes: AppRoute[] = [
  { path: '/blogs', element: <BlogListPage /> },
  { path: '/blogs/:id', element: <BlogDetailPage /> }
]

const userRoutes: AppRoute[] = [
  { path: '/profile', element: <ProfilePage />, guard: 'auth' },
  { path: '/profile/privacy', element: <UserPrivacyPage />, guard: 'auth' }
]

const adminRoutes: AppRoute[] = [
  { path: '/admin/data-lifecycle', element: <AdminDataLifecyclePage />, guard: 'admin' }
]

const authRoutes: AppRoute[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> }
]

const fallbackRoutes: AppRoute[] = [
  { path: '*', element: <NotFoundPage /> }
]

const appRoutes: AppRoute[] = [
  ...coreRoutes,
  ...foodRoutes,
  ...poseRoutes,
  ...blogRoutes,
  ...userRoutes,
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

