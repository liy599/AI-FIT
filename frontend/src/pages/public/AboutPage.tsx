import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type Member = {
  name: string
  role: string
  bio: string
  details: string
  image?: string
}

export default function AboutPage() {
  const members = useMemo<Member[]>(
    () => [
      {
        name: 'Member A',
        role: 'Full-stack / Architecture',
        bio: 'Owns system architecture, APIs, and deployment.',
        details: 'Responsible for backend API design, database modeling, deployment, and overall technical delivery.',
        image: '/assets/images/team/lyk.jpg'
      },
      {
        name: 'Member B',
        role: 'Frontend / UX',
        bio: 'Owns UI and interactions.',
        details: 'Responsible for navigation, animations, shared components, and usability.',
        image: '/assets/images/team/xjl.png'
      },
      {
        name: 'Member C',
        role: 'AI / Vision',
        bio: 'Explores pose and food recognition.',
        details: 'Evaluates TF.js models and browser-side inference approaches (MoveNet/YOLOv8).',
        image: '/assets/images/team/zzx.png'
      },
      {
        name: 'Member D',
        role: 'Data / QA',
        bio: 'Owns testing and data visualization.',
        details: 'Responsible for reporting logic, API verification, and improving test coverage.',
        image: '/assets/images/team/chy.png'
      },
      {
        name: 'Member E',
        role: 'Content / Community',
        bio: 'Owns blog content and tagging.',
        details: 'Responsible for tag strategy, content templates, and community interaction experience.',
        image: '/assets/images/team/dhz.jpg'
      },
      {
        name: 'Member F',
        role: 'Product',
        bio: 'Owns requirements and acceptance.',
        details: 'Responsible for requirement breakdown, acceptance criteria, and optimizing user flows.',
        image: '/assets/images/team/zjl.jpg'
      }
    ],
    []
  )

  const [active, setActive] = useState<Member | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [aboutVisual, setAboutVisual] = useState<'gym' | 'food'>('gym')

  useEffect(() => {
    if (!active) {
      triggerRef.current?.focus()
      return
    }
    closeRef.current?.focus()
  }, [active])

  useEffect(() => {
    const id = window.setInterval(() => {
      setAboutVisual((v) => (v === 'gym' ? 'food' : 'gym'))
    }, 3800)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active])

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">About Us</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>About</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cl_about-area pt-100 pb-100">
        <div className="page-container">
          <div className="cl_about-wrap">
            <div className="about-two-col">
              <div>
                <div className="cl_about-img">
                  <div className={`cl_about-visual-stack ${aboutVisual === 'food' ? 'is-food' : 'is-gym'}`}>
                    <div className="cl_about-visual-label" aria-hidden="true">
                      {aboutVisual === 'food' ? 'Nutrition' : 'Training'}
                    </div>
                    <img
                      className="cl_about-visual-base"
                      src="/assets/images/about/about_privacy_gym.jpg"
                      alt="Gym equipment"
                    />
                    <img
                      className={`cl_about-visual-top${aboutVisual === 'food' ? ' is-active' : ''}`}
                      src="/assets/images/about/about_privacy_food.jpg"
                      alt="Healthy chickpea salad bowl"
                    />
                    <div className="cl_about-visual-badge" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M7 10V8a5 5 0 0 1 10 0v2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6 10h12v10H6V10Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="cl_about-content about-content-offset">
                  <div className="cl_section-area mb-35">
                    <span className="cl_section-subtitle cl_section-subtitle-about">AI FitGuard</span>
                    <h2 className="cl_section-title cl_section-title-small mb-25">A privacy-first fitness and nutrition assistant</h2>
                    <p className="cl_section-text mb-0">
                      AI FitGuard helps you get reliable training guidance and nutrition insights without specialized hardware. Whenever possible, video/image inference runs locally in your browser, and the platform combines community features to support long-term progress.
                    </p>
                  </div>
                  <ul className="cl_about-content-list">
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>Pose coaching
                    </li>
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>Food & nutrition tracking
                    </li>
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>Community blogs and comments
                    </li>
                  </ul>
                  <div className="cl_about-content-btn">
                    <Link to="/tools/pose" className="cl_theme-btn">
                      Try Pose Tool
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M12.9613 11.8986C12.9805 11.8986 13.3488 11.678 13.7796 11.4083C14.2103 11.1385 14.5543 10.9016 14.544 10.882C14.5336 10.8624 14.3268 10.583 14.0842 10.2612C13.5972 9.61499 13.1283 8.76064 12.9205 8.14091C12.273 6.2094 12.571 4.2037 13.7462 2.58473L14.0454 2.17245L13.4757 1.6028L12.9061 1.03311L12.5295 1.30145C10.0626 3.05956 7.10577 2.85727 4.48433 0.751109C4.31316 0.613566 4.16681 0.507421 4.15907 0.515159C4.08782 0.586408 3.19178 2.05146 3.192 2.09632C3.19215 2.12877 3.34886 2.26146 3.54023 2.3911C5.65916 3.8268 8.08355 4.29492 9.95758 3.63031L10.4071 3.4709L4.15728 9.74345L0.205318 13.7098L1.3582 14.8627L5.33478 10.9006L11.5926 4.66555L11.403 5.24471C10.911 6.74715 11.1125 8.52771 11.9778 10.3229C12.2243 10.8344 12.8883 11.8983 12.9613 11.8986Z"
                          fill="currentColor"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cl_team-area pl-30 pr-30">
        <div className="cl_team-wrap pt-100 pb-100">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-team-head">
                <div className="cl_section-area text-center mb-30 pb-2">
                  <span className="cl_section-subtitle">Our Team</span>
                  <h2 className="cl_section-title cl_section-title-white mb-0">Team</h2>
                </div>
              </div>
            </div>
            <div className="team-grid">
              {members.map((m, idx) => (
                <div className="team-grid-col" key={m.name}>
                    <div className="cl_team-item about-team-item">
                      <div className="cl_team-item-img">
                        <img 
                          src={m.image || `/assets/images/team/h1_${(idx % 4) + 1}.png`} 
                          alt={`${m.name} portrait`} 
                          className="about-team-item-image"
                          onError={(e) => {
                            const img = e.currentTarget
                            if (img.dataset.fallbackTried) return
                            img.dataset.fallbackTried = '1'
                            const src = img.getAttribute('src') || ''
                            if (src.toLowerCase().endsWith('.jpg')) img.src = src.replace(/\.jpg$/i, '.png')
                            else if (src.toLowerCase().endsWith('.png')) img.src = src.replace(/\.png$/i, '.jpg')
                            else if (src.toLowerCase().endsWith('.jpeg')) img.src = src.replace(/\.jpeg$/i, '.png')
                          }}
                        />
                      </div>
                    <div className="cl_team-item-content">
                      <h4>
                        <button
                          type="button"
                          className="text-link-btn"
                          onClick={(e) => {
                            triggerRef.current = e.currentTarget
                            setActive(m)
                          }}
                        >
                          {m.name}
                        </button>
                      </h4>
                      <span>{m.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {active ? (
        <div
          className="about-member-modal-overlay"
          onClick={() => setActive(null)}
        >
          <div
            className="cl_blog-widget about-member-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-member-title"
          >
            <h4 className="cl_blog-widget-title mb-30" id="about-member-title">
              {active.name}
            </h4>
            <p>{active.role}</p>
            <p className="about-member-modal-details">{active.details}</p>
            <div className="about-member-modal-actions">
              <button type="button" className="text-link-btn" onClick={() => setActive(null)} ref={closeRef}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

