import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './state/auth-context'
import HomePage from './pages/HomePage'

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
const PoseToolPage = lazy(() => import('./pages/PoseToolPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const UserPrivacyPage = lazy(() => import('./pages/UserPrivacyPage'))

function RequireAuth(props: { children: React.ReactNode }) {
  const auth = useAuth()
  const loc = useLocation()
  if (!auth.user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return props.children
}

function PoseToolLegacyRedirect() {
  const params = useParams<{ exerciseSlug: string }>()
  const loc = useLocation()
  const slug = params.exerciseSlug || 'squat'
  const raw = new URLSearchParams(loc.search).get('mode')
  const target = raw === 'offline' ? `/tools/pose/${slug}/video` : `/tools/pose/${slug}/live`
  return <Navigate to={target} replace />
}

function PoseHistoryLegacyRedirect() {
  const params = useParams<{ exerciseSlug: string }>()
  const slug = params.exerciseSlug || 'squat'
  return <Navigate to={`/tools/pose/${slug}/history`} replace />
}

function PoseReportLegacyRedirect() {
  const params = useParams<{ exerciseSlug: string; sessionId: string }>()
  const slug = params.exerciseSlug || 'squat'
  return <Navigate to={`/tools/pose/${slug}/history`} replace />
}

function PoseDetailReportDisabledRedirect() {
  const params = useParams<{ exerciseSlug: string }>()
  const slug = params.exerciseSlug || 'squat'
  return <Navigate to={`/tools/pose/${slug}/history`} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Suspense fallback={<div className="container py-5">Loading...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/food" element={<FoodModulePage />} />
            <Route path="/food/meal/:mealType" element={<FoodMealPage />} />
            <Route path="/tools/pose" element={<PoseSelectPage />} />
            <Route path="/tools/pose/:exerciseSlug" element={<PoseGuidePage />} />
            <Route path="/tools/pose/:exerciseSlug/live" element={<PoseToolPage />} />
            <Route path="/tools/pose/:exerciseSlug/video" element={<PoseToolPage />} />
            <Route path="/tools/pose/:exerciseSlug/history" element={<RequireAuth children={<PoseTrainingHistoryPage />} />} />
            <Route path="/tools/pose/:exerciseSlug/history/:sessionId" element={<RequireAuth children={<PoseDetailReportDisabledRedirect />} />} />
            <Route path="/tools/pose/:exerciseSlug/tool" element={<PoseToolLegacyRedirect />} />
            <Route path="/tools/pose/:exerciseSlug/tool/history" element={<PoseHistoryLegacyRedirect />} />
            <Route path="/tools/pose/:exerciseSlug/tool/history/:sessionId" element={<PoseReportLegacyRedirect />} />
            <Route path="/tools/food" element={<Navigate to="/food" replace />} />
            <Route path="/blogs" element={<BlogListPage />} />
            <Route path="/blogs/:id" element={<BlogDetailPage />} />
            <Route path="/profile" element={<RequireAuth children={<ProfilePage />} />} />
            <Route path="/profile/privacy" element={<RequireAuth children={<UserPrivacyPage />} />} />
            <Route path="/admin/data-lifecycle" element={<RequireAuth children={<AdminDataLifecyclePage />} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </AuthProvider>
  )
}
