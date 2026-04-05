import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './state/auth-context'
import AboutPage from './pages/AboutPage'
import BlogDetailPage from './pages/BlogDetailPage'
import BlogListPage from './pages/BlogListPage'
import CourseDetailPage from './pages/CourseDetailPage'
import CoursesListPage from './pages/CoursesListPage'
import FoodMealPage from './pages/FoodMealPage'
import FoodModulePage from './pages/FoodModulePage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PoseToolPage from './pages/PoseToolPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

function RequireAuth(props: { children: React.ReactNode }) {
  const auth = useAuth()
  const loc = useLocation()
  if (!auth.user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return props.children
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
          <Route path="/tools/pose" element={<PoseToolPage />} />
          <Route path="/tools/food" element={<Navigate to="/food" replace />} />
          <Route path="/blogs" element={<BlogListPage />} />
          <Route path="/blogs/:id" element={<BlogDetailPage />} />
          <Route path="/courses" element={<RequireAuth children={<CoursesListPage />} />} />
          <Route path="/courses/:id" element={<RequireAuth children={<CourseDetailPage />} />} />
          <Route path="/profile" element={<RequireAuth children={<ProfilePage />} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}

