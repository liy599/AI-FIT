import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

type Member = {
  name: string
  role: string
  bio: string
  details: string
}

export default function AboutPage() {
  const members = useMemo<Member[]>(
    () => [
      {
        name: '成员 A',
        role: '全栈 / 架构',
        bio: '负责系统架构、API与部署。',
        details: '负责后端API设计、数据库建模、Docker部署与整体技术方案落地。'
      },
      {
        name: '成员 B',
        role: '前端 / 交互',
        bio: '负责整体UI与动效。',
        details: '负责导航、动效、全局组件与页面可用性，确保华丽但不喧宾夺主。'
      },
      {
        name: '成员 C',
        role: 'AI / 视觉',
        bio: '负责姿态与食物识别探索。',
        details: '负责TF.js模型调研与前端推理方案评估（MoveNet/YOLOv8）。'
      },
      {
        name: '成员 D',
        role: '数据 / 测试',
        bio: '负责测试与数据可视化。',
        details: '负责统计报告逻辑、接口验证与测试覆盖率提升。'
      },
      {
        name: '成员 E',
        role: '内容 / 运营',
        bio: '负责博客内容与标签体系。',
        details: '负责博客标签策略、内容模板与社区交互体验。'
      },
      {
        name: '成员 F',
        role: '产品 / 需求',
        bio: '负责需求梳理与验收。',
        details: '负责需求拆解、验收标准与用户流程优化。'
      }
    ],
    []
  )

  const [active, setActive] = useState<Member | null>(null)

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
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
        <div className="container">
          <div className="cl_about-wrap">
            <div className="row align-items-center">
              <div className="col-xl-6">
                <div className="cl_about-img">
                  <img src="/assets/images/about/h1_1.png" alt="" />
                </div>
              </div>
              <div className="col-xl-6">
                <div className="cl_about-content mr-80 ml-10">
                  <div className="cl_section-area mb-35">
                    <span className="cl_section-subtitle cl_section-subtitle-about">AI FitGuard</span>
                    <h2 className="cl_section-title cl_section-title-small mb-25">隐私优先的健身与营养助手</h2>
                    <p className="cl_section-text mb-0">
                      AI FitGuard 的愿景是让每个人在无需专业硬件的情况下，也能获得可靠的训练指导与饮食分析。平台尽可能在浏览器本地完成视频/图像推理，并结合社区与课程体系帮助用户持续进步。
                    </p>
                  </div>
                  <ul className="cl_about-content-list">
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>动作矫正（Pose）
                    </li>
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>食物营养分析（Food）
                    </li>
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>社区博客与评论
                    </li>
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>课程报名与评价
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
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8">
                <div className="cl_section-area text-center mb-30 pb-2">
                  <span className="cl_section-subtitle">Our Team</span>
                  <h2 className="cl_section-title cl_section-title-white mb-0">团队成员</h2>
                </div>
              </div>
            </div>
            <div className="row">
              {members.map((m, idx) => (
                <div className="col-xl-3 col-lg-4 col-md-6" key={m.name}>
                  <div className="cl_team-item" style={{ marginBottom: 30 }}>
                    <div className="cl_team-item-img">
                      <img src={`/assets/images/team/h1_${(idx % 4) + 1}.png`} alt="" />
                    </div>
                    <div className="cl_team-item-content">
                      <h4>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setActive(m)
                          }}
                        >
                          {m.name}
                        </a>
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setActive(null)}
        >
          <div
            className="cl_blog-widget"
            style={{ maxWidth: 680, width: '100%', margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="cl_blog-widget-title mb-30">{active.name}</h4>
            <p>{active.role}</p>
            <p style={{ marginTop: 12 }}>{active.details}</p>
            <div style={{ marginTop: 18 }}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setActive(null)
                }}
              >
                Close
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

