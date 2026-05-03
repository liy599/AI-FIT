import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">404 Error</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>404 Error</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cl_error-area pt-100 pb-100">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-notfound">
              <div className="cl_error-content">
                <div className="cl_error-content-img">
                  <img src="/assets/images/bg/404.png" alt="404 illustration" />
                </div>
                <h2 className="cl_error-content-title">Whoops! Page not found</h2>
                <Link to="/" className="cl_theme-btn">
                  Go Back Home
                  <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10.6998 13.6148C10.7126 13.6278 11.1071 13.7274 11.5764 13.8359C12.0457 13.9445 12.4347 14.0168 12.441 13.9966C12.4472 13.9764 12.4958 13.6484 12.5488 13.2678C12.6555 12.5034 12.9137 11.611 13.1897 11.0528C14.0498 9.31332 15.5931 8.16152 17.4648 7.86216L17.9414 7.78591V7.01748V6.24899L17.5094 6.17601C14.6791 5.69792 12.8339 3.56718 12.4887 0.378521C12.4662 0.170304 12.4393 0 12.4289 0C12.3334 0 10.7518 0.383788 10.7219 0.414191C10.7002 0.436176 10.7163 0.631371 10.7577 0.847886C11.2154 3.24541 12.5258 5.19634 14.2264 6.01207L14.6344 6.20775L6.2458 6.22307L0.941406 6.2328V7.78798L6.25944 7.79772L14.6282 7.8131L14.1132 8.07582C12.7772 8.75734 11.7194 10.0942 11.0965 11.8887C10.919 12.3999 10.6511 13.5654 10.6998 13.6148Z"
                      fill="white"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

