type JsonLike = Record<string, unknown>

function asObject(value: unknown): JsonLike {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonLike) : {}
}

// Stamp report payload with policy metadata so archived sessions are version-traceable.
export function stampReportPolicyMeta(report: unknown, policyVersion: string): JsonLike {
  const safeReport = asObject(report)
  const details = asObject(safeReport.details)
  const sections = asObject(safeReport.sections)
  const overview = asObject(sections.overview)
  const policy = {
    version: policyVersion || 'local-default'
  }

  return {
    ...safeReport,
    details: {
      ...details,
      policy
    },
    sections: {
      ...sections,
      overview: {
        ...overview,
        policyVersion: policy.version
      }
    }
  }
}

