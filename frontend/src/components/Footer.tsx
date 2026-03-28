export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/60">
      <div className="mx-auto grid w-full max-w-6xl gap-3 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="text-sm font-semibold">AI FitGuard</div>
          <div className="mt-2 text-xs text-slate-400">
            Privacy-first: 视频/图像默认仅在浏览器本地处理。
          </div>
        </div>
        <div className="text-xs text-slate-400">
          <div className="font-medium text-slate-200">Links</div>
          <div className="mt-2 space-y-1">
            <div>Blog</div>
            <div>Courses</div>
            <div>About Us</div>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          <div className="font-medium text-slate-200">Support</div>
          <div className="mt-2 space-y-1">
            <div>Feedback & Contact</div>
            <div>UCD VM / Docker Deploy</div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} AI FitGuard
      </div>
    </footer>
  )
}

