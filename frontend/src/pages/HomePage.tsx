import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiFetch } from '../lib/api'

type BlogCard = {
  id: number
  title: string
  cover_image_url: string | null
  excerpt: string
  author: { id: number; username: string }
  created_at: string
  tags: { id: number; name: string }[]
}

function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return url
}

function Arrow15() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12.9613 11.8986C12.9805 11.8986 13.3488 11.678 13.7796 11.4083C14.2103 11.1385 14.5543 10.9016 14.544 10.882C14.5336 10.8624 14.3268 10.583 14.0842 10.2612C13.5972 9.61499 13.1283 8.76064 12.9205 8.14091C12.273 6.2094 12.571 4.2037 13.7462 2.58473L14.0454 2.17245L13.4757 1.6028L12.9061 1.03311L12.5295 1.30145C10.0626 3.05956 7.10577 2.85727 4.48433 0.751109C4.31316 0.613566 4.16681 0.507421 4.15907 0.515159C4.08782 0.586408 3.19178 2.05146 3.192 2.09632C3.19215 2.12877 3.34886 2.26146 3.54023 2.3911C5.65916 3.8268 8.08355 4.29492 9.95758 3.63031L10.4071 3.4709L4.15728 9.74345L0.205318 13.7098L1.3582 14.8627L5.33478 10.9006L11.5926 4.66555L11.403 5.24471C10.911 6.74715 11.1125 8.52771 11.9778 10.3229C12.2243 10.8344 12.8883 11.8983 12.9613 11.8986Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function HomePage() {
  const [blogs, setBlogs] = useState<BlogCard[]>([])

  useEffect(() => {
    let cancelled = false
    apiFetch<{ items: BlogCard[] }>('/api/blogs?page=1&page_size=8', { auth: false })
      .then((r) => {
        if (cancelled) return
        setBlogs(r.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const heroBg = '/assets/images/hero/h1_1.png'
  const bigBlog = blogs[0]
  const sideBlogs = blogs.slice(1, 4)

  return (
    <>
      <section className="cl_hero-area">
        <div className="common_width_1">
          <div className="cl_hero-wrap" data-background={heroBg}>
            <div className="cl_hero-content">
              <h1>Train smarter. Eat clearer.</h1>
              <div className="cl_hero-content-btn">
                <Link to="/tools/pose" className="cl_theme-btn cl_hero-btn">
                  Start Pose Coaching <Arrow15 />
                </Link>
                <Link to="/food" className="cl_hero-btn-2">
                  Start Food Tracking <Arrow15 />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cl_blog-area pt-100 pb-70">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-xl-5">
              <div className="cl_section-area text-center mb-30 pb-2">
                <span className="cl_section-subtitle">Our Blogs</span>
                <h2 className="cl_section-title mb-0">Latest Blog Posts</h2>
              </div>
            </div>
          </div>

          {blogs.length === 0 ? (
            <div className="row">
              <div className="col-12">
                <div className="cl_blog_big-item mb-30">
                  <div className="cl_blog_big-item-content">
                    <h3>No posts yet</h3>
                    <p>Create and publish a blog post in your profile, then come back here to see it.</p>
                    <Link to="/profile" className="cl_blog_big-item-content-btn">
                      Create one <Arrow15 />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="row">
              <div className="col-xl-8">
                {bigBlog ? (
                  <div className="cl_blog_big-item mb-30">
                    <div className="cl_blog_big-item-img overflow-hidden rounded-2xl">
                      <Link to={`/blogs/${bigBlog.id}`}>
                        <div className="relative w-full aspect-video max-h-[400px] overflow-hidden bg-slate-100">
                          <img
                            className="absolute inset-0 h-full w-full object-cover object-center"
                            src={resolveMediaUrl(bigBlog.cover_image_url) ?? '/assets/images/blog/h1_1.png'}
                            alt={bigBlog.title}
                          />
                        </div>
                      </Link>
                    </div>
                    <div className="cl_blog_big-item-content">
                      <div className="cl_blog_big-item-content-meta">
                        <span>
                          By <span>{bigBlog.author.username}</span>
                        </span>
                        <span>
                          <span>{new Date(bigBlog.created_at).toLocaleDateString()}</span>
                        </span>
                      </div>
                      <h3>
                        <Link to={`/blogs/${bigBlog.id}`} className="line-clamp-2">
                          {bigBlog.title}
                        </Link>
                      </h3>
                      <p>{bigBlog.excerpt}</p>
                      <Link to={`/blogs/${bigBlog.id}`} className="cl_blog_big-item-content-btn">
                        Read More <Arrow15 />
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="col-xl-4">
                <div className="cl_blog-right pb-20">
                  {sideBlogs.map((b, idx) => (
                    <div className="cl_blog-item mb-10" key={b.id}>
                      <div className="cl_blog-item-img overflow-hidden rounded-xl">
                        <Link to={`/blogs/${b.id}`}>
                          <div className="relative w-full aspect-video max-h-[120px] overflow-hidden bg-slate-100">
                            <img
                              className="absolute inset-0 h-full w-full object-cover object-center"
                              src={resolveMediaUrl(b.cover_image_url) ?? `/assets/images/blog/h1_${idx + 2}.png`}
                              alt={b.title}
                            />
                          </div>
                        </Link>
                      </div>
                      <div className="cl_blog-item-content">
                        <div className="cl_blog-item-content-meta">
                          <span>
                            By <span>{b.author.username}</span>
                          </span>
                          <span>
                            <span>{new Date(b.created_at).toLocaleDateString()}</span>
                          </span>
                        </div>
                        <h4>
                          <Link to={`/blogs/${b.id}`} className="line-clamp-2">
                            {b.title}
                          </Link>
                        </h4>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
