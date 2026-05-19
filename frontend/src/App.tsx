import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { AuthProvider, useAuth } from './state/auth-context'
import HomePage from './pages/public/HomePage'

// Lazy-load pages (code splitting for better performance)
const AboutPage = lazy(() => import('./pages/public/AboutPage'))
const AdminDataLifecyclePage = lazy(() => import('./pages/admin/AdminDataLifecyclePage'))
const AdminFeedbackPage = lazy(() => import('./pages/admin/AdminFeedbackPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const BlogDetailPage = lazy(() => import('./pages/blog/BlogDetailPage'))
const BlogEditorPage = lazy(() => import('./pages/blog/BlogEditorPage'))
const BlogListPage = lazy(() => import('./pages/blog/BlogListPage'))
const FoodMealPage = lazy(() => import('./pages/food/FoodMealPage'))
const FoodModulePage = lazy(() => import('./pages/food/FoodModulePage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage'))
const PoseGuidePage = lazy(() => import('./pages/pose/PoseGuidePage'))
const PoseSelectPage = lazy(() => import('./pages/pose/PoseSelectPage'))
const PoseTrainingHistoryPage = lazy(() => import('./pages/pose/PoseTrainingHistoryPage'))
const PoseTrainingReportPage = lazy(() => import('./pages/pose/PoseTrainingReportPage'))
const PoseToolPage = lazy(() => import('./pages/pose/PoseToolPage'))
const ProfileOnboardingPage = lazy(() => import('./pages/user/ProfileOnboardingPage'))
const ProfilePage = lazy(() => import('./pages/user/ProfilePage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'))
const UserPrivacyPage = lazy(() => import('./pages/user/UserPrivacyPage'))

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
  { path: '/tools/pose/:exerciseSlug/video', element: <PoseToolPage /> },
  { path: '/tools/pose/:exerciseSlug/history', element: <PoseTrainingHistoryPage />, guard: 'auth' },
  { path: '/tools/pose/:exerciseSlug/history/:sessionId', element: <PoseTrainingReportPage />, guard: 'auth' }
]

const blogRoutes: AppRoute[] = [
  { path: '/blogs', element: <BlogListPage /> },
  { path: '/blogs/new', element: <BlogEditorPage />, guard: 'auth' },
  { path: '/blogs/:id', element: <BlogDetailPage /> }
]

const userRoutes: AppRoute[] = [
  { path: '/onboarding/profile', element: <ProfileOnboardingPage />, guard: 'auth' },
  { path: '/profile', element: <ProfilePage />, guard: 'auth' },
  { path: '/profile/privacy', element: <UserPrivacyPage />, guard: 'auth' }
]

const adminRoutes: AppRoute[] = [
  { path: '/admin/data-lifecycle', element: <AdminDataLifecyclePage />, guard: 'admin' },
  { path: '/admin/feedback', element: <AdminFeedbackPage />, guard: 'admin' },
  { path: '/admin/users', element: <AdminUsersPage />, guard: 'admin' }
]

const authRoutes: AppRoute[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> }
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

