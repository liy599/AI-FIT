import { Prisma } from '@prisma/client'

type PrismaErrorPayload = {
  status: number
  error: string
  code: string
}

function schemaMismatchMessage(missingField: string | null) {
  const fieldText = missingField ? ` (missing field: ${missingField})` : ''
  return `Database schema is out of sync with the current version${fieldText}. Run npm run db:migrate and try again. If it still fails locally, run npx prisma migrate reset.`
}

export function toPrismaErrorPayload(error: unknown): PrismaErrorPayload | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null

  if (error.code === 'P2022') {
    const missingField =
      error.meta && typeof error.meta === 'object' && 'column' in error.meta && typeof (error.meta as { column?: unknown }).column === 'string'
        ? (error.meta as { column: string }).column
        : null
    return {
      status: 503,
      code: 'DB_SCHEMA_MISMATCH',
      error: schemaMismatchMessage(missingField)
    }
  }

  if (error.code === 'P2021') {
    return {
      status: 503,
      code: 'DB_SCHEMA_MISMATCH',
      error: 'Database table is missing. Run npm run db:migrate and try again.'
    }
  }

  return {
    status: 500,
    code: `PRISMA_${error.code}`,
    error: 'Database operation failed. Please try again later.'
  }
}
