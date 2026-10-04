import { auditConnection, auditNumericDatabase, AuditBoundaryError } from './audit-numeric-database.ts'

try {
  if (process.argv.length > 2) throw new AuditBoundaryError('AUDIT_ARGUMENTS_NOT_SUPPORTED')
  const report = await auditNumericDatabase(auditConnection(process.env))
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  process.exitCode = report.audit === 'PASS' ? 0 : 1
} catch (error) {
  process.stdout.write(JSON.stringify({ audit: 'REJECTED', code: error instanceof AuditBoundaryError ? error.code : 'AUDIT_DATABASE_UNAVAILABLE',
    externalVerification: 'NOT_VERIFIED' }) + '\n')
  process.exitCode = 2
}
