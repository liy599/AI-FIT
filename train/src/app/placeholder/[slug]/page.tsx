import Link from 'next/link'

const COPY: Record<string, { title: string; subtitle: string }> = {
  diet: { title: 'Nutrition', subtitle: 'In development: meals, macros, and goal tracking will be added.' },
  diet_edit: { title: 'Edit nutrition', subtitle: 'In development: photo recognition, manual entry, and a food database.' },
  scan: { title: 'Scan to log', subtitle: 'In development: barcode/QR scanning and a food database.' },
  water: { title: 'Water', subtitle: 'In development: quick add, reminders, and trends.' },
  weight: { title: 'Weight', subtitle: 'In development: charts, body fat, measurements, and goals.' },
  photo: { title: 'Photos', subtitle: 'In development: photo wall and comparisons.' },
  train_more: { title: 'More tools', subtitle: 'In development: more training tools will be released gradually.' },
  plan_view: { title: 'Plan details', subtitle: 'In development: plan details, exercise programming, and schedule.' },
  plan_join: { title: 'Join a plan', subtitle: 'In development: one-click join and training calendar.' },
  challenge_create: { title: 'Create challenge', subtitle: 'In development: goals, cycles, check-ins, and leaderboard.' },
  challenge_rules: { title: 'Challenge rules', subtitle: 'In development: rules and example templates.' },
  history_report: { title: 'Monthly/Yearly report', subtitle: 'In development: volume, intensity, frequency, and trend reports.' },
  calendar_settings: { title: 'Calendar settings', subtitle: 'In development: week start day, display options, and reminders.' }
}

function normalizeSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/[^a-z0-9_]+/g, '_')
}

export default function PlaceholderPage(props: { params: { slug: string }; searchParams?: Record<string, string | string[] | undefined> }) {
  const { slug } = props.params
  const searchParams = props.searchParams ?? {}

  const key = normalizeSlug(slug)
  const copy = COPY[key] ?? { title: 'In development', subtitle: 'This entry is a placeholder. Please try again later.' }

  const planIdRaw = searchParams.planId
  const planId = Array.isArray(planIdRaw) ? planIdRaw[0] : planIdRaw

  return (
    <main className="container page" style={{ maxWidth: 720 }}>
      <div className="pageTop">
        <div>
          <div className="pageTitle">{copy.title}</div>
          <div className="pageSub">Placeholder</div>
        </div>
      </div>

      <div className="emptyCard card">
        <div className="cardInner emptyInner">
          <div className="emptyIcon">🧩</div>
          <div className="emptyTitle">{copy.title}</div>
          <div className="emptySub">
            {copy.subtitle}
            {planId ? `（planId: ${planId}）` : ''}
          </div>
          <div className="emptyCtas">
            <Link className="btn btnPrimary" href="/dashboard">
              Back to Dashboard
            </Link>
            <Link className="btn btnGhost" href="/train">
              Back to Training
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
