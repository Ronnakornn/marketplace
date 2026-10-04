import { readFile } from 'node:fs/promises'
import { Client, type ClientConfig } from 'pg'
import { numericSnapshotInvariantSql } from './numeric-snapshot-invariants.ts'

export class AuditBoundaryError extends Error {
  constructor(readonly code: string) { super(code) }
}

export type AuditConnection = {
  host: string; port: number; database: string; role: string; password: string
  remoteTls: boolean; caFile?: string
}

export function auditConnection(environment: Readonly<Record<string, string | undefined>>): AuditConnection {
  const required = ['AUDIT_DATABASE_URL', 'AUDIT_EXPECTED_HOST', 'AUDIT_EXPECTED_DATABASE', 'AUDIT_EXPECTED_ROLE'] as const
  if (required.some(key => !environment[key])) throw new AuditBoundaryError('EXPLICIT_AUDIT_IDENTITY_REQUIRED')
  let url: URL
  try { url = new URL(environment.AUDIT_DATABASE_URL!) } catch { throw new AuditBoundaryError('INVALID_AUDIT_URL') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash) throw new AuditBoundaryError('INVALID_AUDIT_URL')
  let database: string
  let role: string
  let password: string
  try {
    database = decodeURIComponent(url.pathname.slice(1))
    role = decodeURIComponent(url.username)
    password = decodeURIComponent(url.password)
  } catch { throw new AuditBoundaryError('INVALID_AUDIT_URL') }
  if (!role || !database || database.includes('/') || url.hostname !== environment.AUDIT_EXPECTED_HOST
    || database !== environment.AUDIT_EXPECTED_DATABASE || role !== environment.AUDIT_EXPECTED_ROLE) {
    throw new AuditBoundaryError('AUDIT_IDENTITY_MISMATCH')
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  const modes = url.searchParams.getAll('sslmode')
  if ([...url.searchParams.keys()].some(key => key !== 'sslmode') || modes.length > 1
    || (local ? modes.length > 0 && modes[0] !== 'verify-full' : modes[0] !== 'verify-full')) {
    throw new AuditBoundaryError('VERIFIED_TLS_REQUIRED')
  }
  return { host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port || '5432'), database, role, password,
    remoteTls: !local || modes[0] === 'verify-full', ...(environment.AUDIT_TLS_CA_FILE ? { caFile: environment.AUDIT_TLS_CA_FILE } : {}) }
}

const privilegeSql = `
  WITH reachable AS (SELECT * FROM pg_roles WHERE oid = (SELECT oid FROM pg_roles WHERE rolname = session_user)
    OR pg_has_role(session_user, oid, 'MEMBER')),
  relations AS (SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','f'))
  SELECT EXISTS (SELECT 1 FROM reachable WHERE rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls) AS administrator,
    EXISTS (SELECT 1 FROM reachable r JOIN pg_database d ON d.datname = current_database()
      WHERE d.datdba = r.oid OR has_database_privilege(r.oid, d.oid, 'CREATE'))
    OR EXISTS (SELECT 1 FROM reachable r CROSS JOIN pg_namespace n WHERE n.nspname NOT LIKE 'pg_%'
      AND n.nspname <> 'information_schema' AND (n.nspowner = r.oid OR has_schema_privilege(r.oid, n.oid, 'CREATE')))
    OR EXISTS (SELECT 1 FROM reachable r JOIN relations c ON c.relowner = r.oid) AS owner_or_creator,
    EXISTS (SELECT 1 FROM reachable r CROSS JOIN relations c
      WHERE has_table_privilege(r.oid, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(r.oid, c.oid, 'INSERT,UPDATE,REFERENCES')) AS table_writer,
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace CROSS JOIN reachable r
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
        AND p.prosecdef AND has_function_privilege(r.oid, p.oid, 'EXECUTE')) AS security_definer,
    EXISTS (SELECT 1 FROM relations WHERE relrowsecurity) AS row_security
`

export async function withAuditSnapshot<T>(connection: AuditConnection, read: (db: Client) => Promise<T>): Promise<T> {
  const configuration: ClientConfig = {
    host: connection.host, port: connection.port, database: connection.database,
    user: connection.role, password: connection.password, connectionTimeoutMillis: 5000,
    ssl: connection.remoteTls ? { rejectUnauthorized: true,
      ...(connection.caFile ? { ca: await readFile(connection.caFile, 'utf8') } : {}) } : false,
  }
  const db = new Client(configuration)
  try {
    await db.connect()
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    await db.query("SET LOCAL search_path = public, pg_catalog")
    await db.query("SET LOCAL statement_timeout = '60s'")
    const identity = (await db.query<{
      database: string; role: string; session_role: string; port: number; address: string
      read_only: string; isolation: string; tls: boolean
    }>(`SELECT current_database() AS database, current_user AS role, session_user AS session_role,
      inet_server_port() AS port, host(inet_server_addr()) AS address,
      current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation,
      COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()), false) AS tls`)).rows[0]!
    if (identity.database !== connection.database || identity.role !== connection.role || identity.session_role !== connection.role
      || identity.port !== connection.port || identity.read_only !== 'on' || identity.isolation !== 'repeatable read'
      || (connection.remoteTls && !identity.tls)
      || (!connection.remoteTls && !['127.0.0.1', '::1'].includes(identity.address))) {
      throw new AuditBoundaryError('CONNECTED_IDENTITY_MISMATCH')
    }
    const rights = (await db.query<{ administrator: boolean; owner_or_creator: boolean; table_writer: boolean; security_definer: boolean; row_security: boolean }>(privilegeSql)).rows[0]!
    if (rights.administrator) throw new AuditBoundaryError('ADMINISTRATOR_ROLE_REJECTED')
    if (rights.owner_or_creator) throw new AuditBoundaryError('OWNER_OR_CREATOR_ROLE_REJECTED')
    if (rights.table_writer) throw new AuditBoundaryError('TABLE_WRITER_ROLE_REJECTED')
    if (rights.security_definer) throw new AuditBoundaryError('SECURITY_DEFINER_ACCESS_REJECTED')
    if (rights.row_security) throw new AuditBoundaryError('ROW_SECURITY_REQUIRES_SEPARATE_AUDIT')
    return await read(db)
  } finally {
    try { await db.query('ROLLBACK') } finally { await db.end() }
  }
}

const aggregateSql = `
  SELECT 'Order' AS source, currency, status::text AS status, 'status' AS grouped_by, COUNT(*)::text AS rows, SUM("grandTotal")::text AS amount FROM "Order" GROUP BY currency,status
  UNION ALL SELECT 'ShopOrder',currency,status::text,'status',COUNT(*)::text,SUM("grandTotal")::text FROM "ShopOrder" GROUP BY currency,status
  UNION ALL SELECT 'Payment',currency,status::text,'status',COUNT(*)::text,SUM(amount)::text FROM "Payment" GROUP BY currency,status
  UNION ALL SELECT 'Refund',p.currency,r.status::text,'status',COUNT(*)::text,SUM(r.amount)::text FROM "Refund" r JOIN "Payment" p ON p.id=r."paymentId" GROUP BY p.currency,r.status
  UNION ALL SELECT 'SellerPayout',currency,status::text,'status',COUNT(*)::text,SUM(amount)::text FROM "SellerPayout" GROUP BY currency,status
  UNION ALL SELECT 'WalletLedgerEntry',currency,type::text,'type',COUNT(*)::text,SUM(amount)::text FROM "WalletLedgerEntry" GROUP BY currency,type
  ORDER BY source,currency,status
`
const countsSql = `SELECT 'Order' AS source,COUNT(*)::text AS rows FROM "Order"
  UNION ALL SELECT 'Payment',COUNT(*)::text FROM "Payment"
  UNION ALL SELECT 'OrderItem',COUNT(*)::text FROM "OrderItem"
  UNION ALL SELECT 'ShopOrder',COUNT(*)::text FROM "ShopOrder"
  UNION ALL SELECT 'Refund',COUNT(*)::text FROM "Refund"
  UNION ALL SELECT 'SellerPayout',COUNT(*)::text FROM "SellerPayout"
  UNION ALL SELECT 'WalletLedgerEntry',COUNT(*)::text FROM "WalletLedgerEntry"
  UNION ALL SELECT 'Inventory',COUNT(*)::text FROM "Inventory" ORDER BY source`

const completenessSql = `
  SELECT 'original_v2_item_snapshot_completeness' AS "check", COUNT(*)::text AS violations
  FROM "ShopSaleSnapshot" s JOIN "ShopOrder" so ON so.id = s."shopOrderId"
    JOIN "OrderItem" i ON i."orderId" = so."orderId" AND i."shopId" = so."shopId"
  WHERE s."policyVersion" = 2 AND NOT EXISTS (
    SELECT 1 FROM "ItemSaleSnapshot" snapshot
    WHERE snapshot."orderItemId" = i.id AND snapshot."shopOrderId" = s."shopOrderId")
  UNION ALL
  SELECT 'shipping_only_refund_cash', COUNT(*)::text FROM "Refund" r
  WHERE NOT EXISTS (SELECT 1 FROM "RefundItemAllocation" i WHERE i."refundId" = r.id)
    AND EXISTS (SELECT 1 FROM "RefundShopAllocation" s WHERE s."refundId" = r.id)
    AND r.amount <> (SELECT SUM(s."buyerShippingRefund" + s."buyerShippingTaxRefund")
      FROM "RefundShopAllocation" s WHERE s."refundId" = r.id)
`

export async function auditNumericDatabase(connection: AuditConnection) {
  return withAuditSnapshot(connection, async db => {
    const violations = (await db.query<{ check: string; violations: string }>(numericSnapshotInvariantSql)).rows
    const additionalViolations = (await db.query<{ check: string; violations: string }>(completenessSql)).rows
    const counts = (await db.query<{ source: string; rows: string }>(countsSql)).rows
    const aggregates = (await db.query<{ source: string; currency: string; status: string; grouped_by: string; rows: string; amount: string }>(aggregateSql)).rows
    return { audit: [...violations, ...additionalViolations].some(row => row.violations !== '0') ? 'DISCREPANCIES' as const : 'PASS' as const,
      databaseReadOnly: true, isolation: 'repeatable read', externalVerification: 'NOT_VERIFIED',
      scope: 'Twelve stored snapshot invariants, two additional completeness checks and grouped monetary totals; bank transfers and complete wallet/cache history are not verified.',
      checkedAt: new Date().toISOString(), counts, violations, additionalViolations, aggregates }
  })
}
