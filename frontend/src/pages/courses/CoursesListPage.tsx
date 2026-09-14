import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

type Course = { id: number; title: string; cover_image_url: string | null; instructor_name: string; is_free: boolean; price: number | null; enroll_count: number; avg_rating: number | null }
const courseFallbackImages = [
  '/assets/images/pose/deep-squat.jpg',
  '/assets/images/pose/lateral-raise.jpg',
  '/assets/images/pose/push-up.jpg',
]
export default function CoursesListPage() {
  const [items, setItems] = useState<Course[]>([])
  const [error, setError] = useState('')
  useEffect(() => { apiFetch<{ items: Course[] }>('/api/courses?page=1&page_size=12').then((data) => setItems(data.items)).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load courses')) }, [])
  return <section className="pt-100 pb-100"><div className="container"><div className="cl_blog-widget mb-30">
    <h1 className="cl_blog-widget-title">Courses</h1><p>Follow structured fitness learning paths alongside Pose training.</p>{error ? <p>{error}</p> : null}
    <div className="row">{items.map((course, index) => <div className="col-md-4" key={course.id}><div className="cl_price-item mb-30">
      <img src={course.cover_image_url || courseFallbackImages[index % courseFallbackImages.length]} alt={course.title} style={{ width: '100%', height: 190, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }} />
      <h4 className="cl_price-item-title">{course.title}</h4><p>Instructor: {course.instructor_name}</p><p>{course.is_free ? 'Free' : course.price}</p><Link to={`/courses/${course.id}`}>View details</Link>
    </div></div>)}</div>
  </div></div></section>
}
