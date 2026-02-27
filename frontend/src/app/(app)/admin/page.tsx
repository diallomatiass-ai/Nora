'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, Users, Mail, Sparkles, TrendingUp,
  Trash2, UserCheck, UserX, RefreshCw, CheckCircle,
  XCircle, AlertTriangle, Clock, Building2,
} from 'lucide-react'
import { api } from '@/lib/api'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface AdminStats {
  total_users: number
  total_emails: number
  total_suggestions: number
  approved: number
  rejected: number
  approved_ratio: number
  rejected_ratio: number
  active_users_last_7_days: number
}

interface AdminUser {
  id: string
  name: string
  email: string
  company_name: string | null
  role: string
  created_at: string
  email_count: number
  suggestion_count: number
}

interface AdminEmail {
  id: string
  user_id: string
  user_email: string
  from_address: string
  from_name: string | null
  subject: string | null
  category: string | null
  urgency: string | null
  is_read: boolean
  received_at: string | null
  created_at: string
}

interface HealthStatus {
  status: string
  database: string
  redis: string
  timestamp: string
}

interface CurrentUser {
  id: string
  role: string
  name: string
  email: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Nu'
  if (mins < 60) return `${mins}m siden`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}t siden`
  const days = Math.floor(hours / 24)
  return `${days}d siden`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('da-DK', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Stat-kort ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="glass-card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Badge-komponent ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#42D1B9]/15 text-[#162249] dark:text-[#42D1B9]">
        <ShieldCheck className="w-3 h-3" />
        Admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
      Bruger
    </span>
  )
}

function UrgencyBadge({ urgency }: { urgency: string | null }) {
  if (!urgency) return null
  const map: Record<string, { label: string; cls: string }> = {
    high:   { label: 'Akut',   cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
    medium: { label: 'Medium', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    low:    { label: 'Lav',    cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300' },
  }
  const cfg = map[urgency] ?? map.low
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Hoved-komponent ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()

  const [currentUser, setCurrentUser]     = useState<CurrentUser | null>(null)
  const [stats, setStats]                 = useState<AdminStats | null>(null)
  const [users, setUsers]                 = useState<AdminUser[]>([])
  const [emails, setEmails]               = useState<AdminEmail[]>([])
  const [health, setHealth]               = useState<HealthStatus | null>(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null)
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Toast-helper ──────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Hent alle data ────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsData, usersData, emailsData, healthData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminRecentEmails(),
        api.getAdminHealth(),
      ])
      setStats(statsData)
      setUsers(usersData)
      setEmails(emailsData)
      setHealth(healthData)
    } catch (err: any) {
      setError(err.message || 'Kunne ikke hente admin-data')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Auth-check + initial load ─────────────────────────────────────────────

  useEffect(() => {
    api.getMe()
      .then((user: CurrentUser) => {
        setCurrentUser(user)
        if (user.role !== 'admin') {
          router.replace('/')
        } else {
          loadAll()
        }
      })
      .catch(() => router.replace('/login'))
  }, [router, loadAll])

  // ── Rolle-handling ────────────────────────────────────────────────────────

  const handleRoleToggle = async (user: AdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    setPendingAction(user.id + '_role')
    try {
      await api.updateUserRole(user.id, newRole)
      showToast(
        newRole === 'admin'
          ? `${user.name} er nu administrator`
          : `${user.name} er ikke længere administrator`,
      )
      await loadAll()
    } catch (err: any) {
      showToast(err.message || 'Rolleskift fejlede', false)
    } finally {
      setPendingAction(null)
    }
  }

  // ── Slet-handling ─────────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    setPendingAction(confirmDelete.id + '_delete')
    try {
      await api.deleteAdminUser(confirmDelete.id)
      showToast(`${confirmDelete.name} er slettet`)
      setConfirmDelete(null)
      await loadAll()
    } catch (err: any) {
      showToast(err.message || 'Sletning fejlede', false)
    } finally {
      setPendingAction(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!currentUser || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#42D1B9] animate-spin" />
          <p className="text-sm text-[var(--text-muted)]">Indlæser admin-panel...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="glass-card p-6 max-w-md text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-sm text-[var(--text-secondary)]">{error}</p>
          <button onClick={loadAll} className="btn-primary">
            Prøv igen
          </button>
        </div>
      </div>
    )
  }

  const approvalPct = stats ? Math.round(stats.approved_ratio * 100) : 0

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fadeIn">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slideUp ${
          toast.ok
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.ok
            ? <CheckCircle className="w-4 h-4" />
            : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* ── Overskrift ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#42D1B9]/15">
            <ShieldCheck className="w-6 h-6 text-[#42D1B9]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Admin-panel</h1>
            <p className="text-xs text-[var(--text-muted)]">Systemoverblik og brugeradministration</p>
          </div>
        </div>
        <button
          onClick={loadAll}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Opdater
        </button>
      </div>

      {/* ── System Health ── */}
      {health && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
          health.status === 'ok'
            ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
        }`}>
          {health.status === 'ok'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          <span>
            System {health.status === 'ok' ? 'kører normalt' : 'har problemer'}
          </span>
          <span className="text-[var(--text-muted)] font-normal ml-auto text-xs">
            Database: {health.database === 'ok' ? 'OK' : 'FEJL'}
            {' · '}
            Redis: {health.redis === 'ok' ? 'OK' : 'FEJL'}
          </span>
        </div>
      )}

      {/* ── Stat-kort ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Users}
            label="Brugere i alt"
            value={stats.total_users}
            sub={`${stats.active_users_last_7_days} aktive seneste 7 dage`}
            color="bg-[#162249]"
          />
          <StatCard
            icon={Mail}
            label="Emails i alt"
            value={stats.total_emails}
            color="bg-[#42D1B9]"
          />
          <StatCard
            icon={Sparkles}
            label="AI-forslag i alt"
            value={stats.total_suggestions}
            sub={`${stats.approved} godkendt · ${stats.rejected} afvist`}
            color="bg-purple-600"
          />
          <StatCard
            icon={TrendingUp}
            label="Godkendelsesrate"
            value={`${approvalPct}%`}
            sub={`${stats.approved} ud af ${stats.total_suggestions} forslag`}
            color={approvalPct >= 60 ? 'bg-green-600' : 'bg-amber-500'}
          />
        </div>
      )}

      {/* ── Brugertabel ── */}
      <section className="glass-card p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#42D1B9]" />
            Brugere ({users.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Navn / Email', 'Firma', 'Rolle', 'Oprettet', 'Mails', 'Forslag', 'Handlinger'].map(h => (
                  <th key={h} className="pb-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-4 last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {users.map(u => {
                const isSelf = u.id === currentUser?.id
                const isPending = pendingAction?.startsWith(u.id)
                return (
                  <tr key={u.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    {/* Navn + email */}
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[var(--text-primary)] truncate max-w-[160px]">{u.name}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate max-w-[160px]">{u.email}</p>
                    </td>
                    {/* Firma */}
                    <td className="py-3 pr-4">
                      {u.company_name ? (
                        <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate max-w-[120px]">{u.company_name}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    {/* Rolle */}
                    <td className="py-3 pr-4">
                      <RoleBadge role={u.role} />
                    </td>
                    {/* Oprettet */}
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Clock className="w-3 h-3" />
                        {formatDate(u.created_at)}
                      </span>
                    </td>
                    {/* Mails */}
                    <td className="py-3 pr-4 text-[var(--text-secondary)] font-medium">
                      {u.email_count}
                    </td>
                    {/* Forslag */}
                    <td className="py-3 pr-4 text-[var(--text-secondary)] font-medium">
                      {u.suggestion_count}
                    </td>
                    {/* Handlinger */}
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {/* Rolle-toggle */}
                        <button
                          onClick={() => handleRoleToggle(u)}
                          disabled={isSelf || !!isPending}
                          title={isSelf ? 'Kan ikke ændre din egen rolle' : u.role === 'admin' ? 'Fjern admin' : 'Gør til admin'}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            u.role === 'admin'
                              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30'
                              : 'bg-[#42D1B9]/15 text-[#162249] dark:text-[#42D1B9] hover:bg-[#42D1B9]/25'
                          }`}
                        >
                          {isPending && pendingAction === u.id + '_role' ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : u.role === 'admin' ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                          {u.role === 'admin' ? 'Fjern admin' : 'Gør til admin'}
                        </button>

                        {/* Slet */}
                        <button
                          onClick={() => setConfirmDelete(u)}
                          disabled={isSelf || !!isPending}
                          title={isSelf ? 'Kan ikke slette din egen konto' : 'Slet bruger'}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isPending && pendingAction === u.id + '_delete' ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Slet
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="py-10 text-center text-sm text-[var(--text-muted)]">
              Ingen brugere fundet
            </div>
          )}
        </div>
      </section>

      {/* ── Seneste emails ── */}
      <section className="glass-card p-4 md:p-5">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-[#42D1B9]" />
          Seneste 10 emails (på tværs af alle brugere)
        </h2>

        <div className="space-y-1">
          {emails.slice(0, 10).map(email => (
            <div
              key={email.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors border-l-4 ${
                email.urgency === 'high'
                  ? 'border-l-red-500'
                  : email.urgency === 'medium'
                  ? 'border-l-amber-400'
                  : 'border-l-[#42D1B9]/40'
              }`}
            >
              {/* Afsender + emne */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {email.subject || '(Intet emne)'}
                  </p>
                  {!email.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#42D1B9] flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  Fra: {email.from_name || email.from_address}
                </p>
              </div>

              {/* Urgency */}
              <UrgencyBadge urgency={email.urgency} />

              {/* Brugerkonto */}
              <span className="text-xs text-[var(--text-muted)] truncate max-w-[120px] hidden md:block">
                {email.user_email}
              </span>

              {/* Tidspunkt */}
              {email.received_at && (
                <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                  {timeAgo(email.received_at)}
                </span>
              )}
            </div>
          ))}

          {emails.length === 0 && (
            <div className="py-10 text-center text-sm text-[var(--text-muted)]">
              Ingen emails fundet
            </div>
          )}
        </div>
      </section>

      {/* ── Slet-bekræftelse modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card p-6 max-w-sm w-full mx-4 space-y-4 animate-slideUp">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Slet bruger?</h3>
                <p className="text-xs text-[var(--text-muted)]">Denne handling kan ikke fortrydes</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Du er ved at slette{' '}
              <span className="font-semibold text-[var(--text-primary)]">{confirmDelete.name}</span>
              {' '}({confirmDelete.email}) og alle tilknyttede data.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Annuller
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={!!pendingAction}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
              >
                {pendingAction ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Slet bruger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
