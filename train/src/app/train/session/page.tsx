import TrainClient from '../TrainClient'

export default function TrainSessionPage({ searchParams }: { searchParams: { trainingId?: string } }) {
  const trainingId = typeof searchParams.trainingId === 'string' ? searchParams.trainingId : null
  return <TrainClient trainingId={trainingId} />
}

