import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './state/auth-context'
import AboutPage from './pages/AboutPage'
import AdminDataLifecyclePage from './pages/AdminDataLifecyclePage'
import BlogDetailPage from './pages/BlogDetailPage'
import BlogListPage from './pages/BlogListPage'
import FoodMealPage from './pages/FoodMealPage'
import FoodModulePage from './pages/FoodModulePage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PoseGuidePage from './pages/PoseGuidePage'
import PoseSelectPage from './pages/PoseSelectPage'
import PoseTrainingHistoryPage from './pages/PoseTrainingHistoryPage'
import PoseToolPage from './pages/PoseToolPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import UserPrivacyPage from './pages/UserPrivacyPage'

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
          {/* Detail report page is temporarily disabled until the final report flow is cleaned up. */}
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
      </Layout>
    </AuthProvider>
  )
}
