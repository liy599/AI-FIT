import AnalysisJobClient from './AnalysisJobClient'

export default function AnalysisJobPage({ params }: { params: { id: string } }) {
  return <AnalysisJobClient jobId={params.id} />
}
