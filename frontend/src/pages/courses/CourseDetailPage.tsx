import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

type Course = { id: number; title: string; cover_image_url: string | null; description: string; instructor_name: string; is_free: boolean; price: number | null; enrolled: boolean }
const courseFallbackImages = [
  '/assets/images/pose/deep-squat.jpg',
  '/assets/images/pose/lateral-raise.jpg',
  '/assets/images/pose/push-up.jpg',
]
export default function CourseDetailPage() {
  const { id } = useParams(); const [course, setCourse] = useState<Course | null>(null); const [message, setMessage] = useState('')
  useEffect(() => { apiFetch<Course>(`/api/courses/${id}`).then(setCourse).catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Unable to load course')) }, [id])
  async function enroll() { if (!course) return; await apiFetch(`/api/courses/${course.id}/enroll`, { method: 'POST', body: JSON.stringify({ paid: true }) }); setCourse({ ...course, enrolled: true }) }
  return <section className="pt-100 pb-100"><div className="container"><div className="cl_blog-widget">
    <Link to="/courses">Courses</Link>{message ? <p>{message}</p> : null}{course ? <><img src={course.cover_image_url || courseFallbackImages[(course.id - 1) % courseFallbackImages.length]} alt={course.title} style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 8, margin: '20px 0' }} /><h1 className="cl_blog-widget-title">{course.title}</h1><p>Instructor: {course.instructor_name}</p><p>{course.description}</p>{course.enrolled ? <p>Enrolled</p> : <button className="cl_theme-btn" onClick={() => enroll().catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Enrollment failed'))}>Enroll</button>}</> : null}
  </div></div></section>
}
