export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="container siteFooterInner">
        <div className="muted">
          By default, this site does not store original videos. Only the necessary structured analysis data is saved. You can change settings and export/delete your data in Privacy.
        </div>
        <div className="muted">© {new Date().getFullYear()} Train</div>
      </div>
    </footer>
  )
}
