import { useEffect, useState } from 'react'
import { api } from '../api/client'

interface AuditLog {
  id: string
  userName: string | null
  action: string
  entityType: string
  entityId: string | null
  ip: string
  metadata: unknown
  createdAt: string
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<{ logs: AuditLog[] }>('/admin/audit-logs?page=1&pageSize=100')
      .then((result) => setLogs(result.logs))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Audit logs could not be loaded.'),
      )
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-slate-500">Loading audit logs…</p>
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
        {error}
      </p>
    )
  if (!logs.length)
    return (
      <p className="rounded-xl border border-dashed border-slate-400/30 px-6 py-10 text-center text-sm text-slate-500">
        No audit activity recorded yet.
      </p>
    )

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-400/20 bg-white dark:border-teal-800 dark:bg-teal-900/60">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-paper/70 text-xs uppercase text-slate-500 dark:bg-teal-950/50">
          <tr>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Entity</th>
            <th className="px-4 py-3">IP</th>
            <th className="px-4 py-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-slate-400/10 dark:border-teal-800">
              <td className="px-4 py-3 text-slate-500">
                {new Date(log.createdAt.replace(' ', 'T') + 'Z').toLocaleString()}
              </td>
              <td className="px-4 py-3 text-ink dark:text-paper">{log.userName ?? 'Unknown account'}</td>
              <td className="px-4 py-3 font-medium text-ink dark:text-paper">{log.action}</td>
              <td className="px-4 py-3 text-slate-500">
                {log.entityType}
                {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}
              </td>
              <td className="px-4 py-3 text-slate-500">{log.ip}</td>
              <td className="max-w-56 truncate px-4 py-3 text-xs text-slate-500">
                {log.metadata ? JSON.stringify(log.metadata) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
