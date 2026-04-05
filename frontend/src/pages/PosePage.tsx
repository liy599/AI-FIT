export { default } from './PoseToolPage'
/*
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function PosePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      const v = videoRef.current
      const stream = v?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      if (videoRef.current) videoRef.current.srcObject = stream
      setRunning(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '无法打开摄像头')
    }
  }

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Pose Tool</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Pose</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="container">
          <div className="row">
            <div className="col-xl-7 col-lg-7">
              <div className="cl_blog-widget mb-30">
                <h4 className="cl_blog-widget-title mb-30">Camera</h4>
                <div style={{ borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '16/9' as any }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a
                    href="#"
                    className="cl_theme-btn"
                    onClick={(e) => {
                      e.preventDefault()
                      start().catch(() => {})
                    }}
                  >
                    {running ? 'Reconnect' : 'Start'}
                  </a>
                  <span style={{ opacity: 0.85 }}>MoveNet 骨架绘制区域（待接入）</span>
                </div>
                {error ? <div style={{ marginTop: 12 }}>{error}</div> : null}
              </div>
            </div>

            <div className="col-xl-5 col-lg-5">
              <div className="cl_blog-widget mb-30">
                <h4 className="cl_blog-widget-title mb-30">Realtime Analysis</h4>
                <ul>
                  <li>
                    <a href="#" onClick={(e) => e.preventDefault()}>
                      <span>
                        <i className="fa-light fa-chevrons-right"></i>识别动作
                      </span>{' '}
                      (—)
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => e.preventDefault()}>
                      <span>
                        <i className="fa-light fa-chevrons-right"></i>实时评分
                      </span>{' '}
                      (0)
                    </a>
                  </li>
                </ul>
                <div style={{ marginTop: 18 }}>
                  <h6 className="sub-title mb-15">纠正建议</h6>
                  <p style={{ marginBottom: 0 }}>进入模型后在此输出如“膝盖不要超过脚尖”等提示。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
*/

