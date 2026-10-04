import { describe, expect, it } from 'vitest'
import { auditConnection } from './audit-numeric-database.ts'

const environment = {
  AUDIT_DATABASE_URL: 'postgresql://reader:secret@127.0.0.1:55439/marketplace_test_audit',
  AUDIT_EXPECTED_HOST: '127.0.0.1', AUDIT_EXPECTED_DATABASE: 'marketplace_test_audit', AUDIT_EXPECTED_ROLE: 'reader',
}

describe('explicit audit connection boundary', () => {
  it('never falls back to the global application writer URL', () => {
    expect(() => auditConnection({ DATABASE_URL: environment.AUDIT_DATABASE_URL })).toThrow('EXPLICIT_AUDIT_IDENTITY_REQUIRED')
  })
  it.each(['AUDIT_EXPECTED_HOST', 'AUDIT_EXPECTED_DATABASE', 'AUDIT_EXPECTED_ROLE'])('rejects a mismatched %s', key => {
    expect(() => auditConnection({ ...environment, [key]: 'different' })).toThrow('AUDIT_IDENTITY_MISMATCH')
  })
  it('allows a pinned loopback identity with separate connection fields', () => {
    expect(auditConnection(environment)).toEqual({ host: '127.0.0.1', port: 55439, database: 'marketplace_test_audit', role: 'reader', password: 'secret', remoteTls: false })
  })
  it.each(['', '?sslmode=require', '?sslmode=disable', '?sslmode=verify-ca', '?sslmode=verify-full&sslmode=disable', '?sslmode=verify-full&options=-c%20role%3Dwriter'])('rejects unsafe remote TLS/options %s', suffix => {
    expect(() => auditConnection({ ...environment, AUDIT_EXPECTED_HOST: 'audit.example.test', AUDIT_DATABASE_URL: `postgresql://reader:secret@audit.example.test/marketplace_test_audit${suffix}` })).toThrow('VERIFIED_TLS_REQUIRED')
  })
  it('requires certificate verification for an explicitly pinned remote host', () => {
    expect(auditConnection({ ...environment, AUDIT_EXPECTED_HOST: 'audit.example.test', AUDIT_DATABASE_URL: 'postgresql://reader:secret@audit.example.test/marketplace_test_audit?sslmode=verify-full', AUDIT_TLS_CA_FILE: 'private-ca.pem' })).toMatchObject({ remoteTls: true, caFile: 'private-ca.pem' })
  })
})
