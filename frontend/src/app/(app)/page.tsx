'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import {
  AlertTriangle, CheckCircle, Phone,
  PhoneIncoming, ChevronRight, Mail, ClipboardList, MapPin, Clock, X,
} from 'lucide-react'

interface TopEmail {
  id: string
  subject: string
  from_address: string
  from_name: string | null
  urgency: string
  category: string | null
  received_at: string | null
}

interface DashboardData {
  user_name: string
  unread: number
  high_priority: number
  pending_suggestions: number
  week_total: number
  top_urgent: TopEmail[]
}

interface RecentCall {
  id: string
  caller_name: string | null
  caller_phone: string | null
  summary: string
  urgency: string
  status: string
  called_at: string
}

interface CallDashboardData {
  total_calls: number
  new_calls: number
  urgent_calls: number
  week_calls: number
  is_configured: boolean
  top_recent: RecentCall[]
}

interface TaskItem {
  id: string
  customer_id: string
  action: string
  description: string | null
  deadline: string | null
  status: string
  customer_name: string | null
  created_at: string
}

function greeting(name: string): string {
  const h = new Date().getHours()
  if (h < 10) return `God morgen, ${name}`
  if (h < 12) return `God formiddag, ${name}`
  if (h < 18) return `God eftermiddag, ${name}`
  return `God aften, ${name}`
}

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

export default function Dashboard() {
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [callDash, setCallDash] = useState<CallDashboardData | null>(null)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const { t } = useTranslation()

  // Hover preview state
  const [preview, setPreview] = useState<{ type: 'email' | 'call'; id: string } | null>(null)
  const [previewPos, setPreviewPos] = useState<{ top: number; left: number; fromRight: boolean }>({ top: 0, left: 0, fromRight: false })
  const [emailDetail, setEmailDetail] = useState<Record<string, any>>({})
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getDashboardSummary().then(setDash).catch(console.error)
    api.getCallDashboard().then(setCallDash).catch(console.error)
    // Hent alle åbne opgaver (overdue + pending), sorteret med overdue først
    Promise.all([
      api.listActionItems({ status: 'overdue' }),
      api.listActionItems({ status: 'pending' }),
    ]).then(([overdue, pending]: [TaskItem[], TaskItem[]]) => {
      setTasks([...overdue, ...pending])
    }).catch(console.error)
  }, [])

  const showPreview = useCallback((type: 'email' | 'call', id: string, e: React.MouseEvent) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    hoverTimeout.current = setTimeout(() => {
      // Placér panelet til højre for elementet, eller til venstre hvis der ikke er plads
      const panelW = 384 // w-96 = 24rem = 384px
      const spaceRight = window.innerWidth - rect.right
      const fromRight = spaceRight < panelW + 16
      const left = fromRight ? Math.max(8, rect.left - panelW - 8) : rect.right + 8
      // Centrér vertikalt med elementet, men hold inden for viewport
      const top = Math.min(Math.max(8, rect.top - 40), window.innerHeight - 400)
      setPreviewPos({ top, left, fromRight })
      setPreview({ type, id })
      // Hent email-detaljer on-demand
      if (type === 'email' && !emailDetail[id]) {
        api.getEmail(id).then(data => {
          setEmailDetail(prev => ({ ...prev, [id]: data }))
        }).catch(() => {})
      }
    }, 300)
  }, [emailDetail])

  const hidePreview = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    hoverTimeout.current = setTimeout(() => setPreview(null), 200)
  }, [])

  const keepPreview = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
  }, [])

  // Beregn samlet antal
  const urgentCount = (dash?.high_priority ?? 0) + (callDash?.urgent_calls ?? 0)
  const newCount = (dash?.unread ?? 0) + (callDash?.new_calls ?? 0)
  const openTasks = tasks.length

  // ── Data til kolonner (urgent først, API sorterer allerede) ──
  const allEmails = dash?.top_urgent ?? []
  const allRecentCalls = callDash?.top_recent ?? []
  // Kolonne 2: akutte/nye først, derefter resten
  const urgentCallsFirst = [
    ...allRecentCalls.filter(c => c.urgency === 'high' || c.status === 'new'),
    ...allRecentCalls.filter(c => c.urgency !== 'high' && c.status !== 'new'),
  ]

  // Find call by id for preview
  const allCalls = callDash?.top_recent ?? []
  const previewCall = preview?.type === 'call' ? allCalls.find(c => c.id === preview.id) : null
  const previewEmail = preview?.type === 'email' ? allEmails.find(e => e.id === preview.id) : null
  const previewEmailFull = preview?.type === 'email' ? emailDetail[preview.id] : null

  return (
    <div className="p-4 md:p-6 animate-fadeIn space-y-5 relative">
      {/* Hilsen */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
          {dash ? greeting(dash.user_name) : 'Dashboard'}
        </h1>
      </div>

      {/* 3 Stat-bokse */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label={t('urgent')} value={urgentCount} color="text-red-700 dark:text-red-400" bg="bg-red-50 dark:bg-red-500/10" borderColor="border-red-200 dark:border-red-500/20" />
        <StatBox label={t('newItems')} value={newCount} color="text-[#162249] dark:text-[#42D1B9]" bg="bg-[#42D1B9]/10" borderColor="border-[#42D1B9]/20" />
        <StatBox label={t('tasks')} value={openTasks} color="text-amber-700 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-500/10" borderColor="border-amber-200 dark:border-amber-500/20" />
      </div>

      {/* 3 Kolonner + hover preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Kolonne 1: Mails der haster ── */}
        <section className="card p-4 flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              Mails der haster
            </h2>
            <Link href="/inbox?urgency=high" className="text-xs text-[#42D1B9] hover:text-[#56DEC8] hover:underline">Se alle</Link>
          </div>
          {allEmails.length > 0 ? (
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0">
              {allEmails.map(e => {
                const waitTime = e.received_at ? timeAgo(e.received_at) : null
                const isActive = preview?.type === 'email' && preview.id === e.id
                return (
                  <div
                    key={e.id}
                    onMouseEnter={(ev) => showPreview('email', e.id, ev)}
                    onMouseLeave={hidePreview}
                    className={`relative px-3 py-2.5 rounded-lg transition-colors border-l-4 cursor-pointer ${
                      e.urgency === 'high' ? 'border-l-red-500' : 'border-l-amber-400'
                    } ${isActive ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate flex-1">
                        {e.subject || '(Intet emne)'}
                      </p>
                      {waitTime && (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                          {waitTime}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] truncate">{e.from_name || e.from_address}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <CheckCircle className="w-6 h-6 mx-auto mb-1.5 text-green-500" />
              <p className="text-xs text-[var(--text-muted)]">Ingen akutte mails</p>
            </div>
          )}
        </section>

        {/* ── Kolonne 2: Henvendelser der haster ── */}
        <section className="card p-4 flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <PhoneIncoming className="w-4 h-4" />
              Haster
            </h2>
            <Link href="/ai-secretary" className="text-xs text-[#42D1B9] hover:text-[#56DEC8] hover:underline">Se alle</Link>
          </div>
          {urgentCallsFirst.length > 0 ? (
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0">
              {urgentCallsFirst.map(c => {
                const isActive = preview?.type === 'call' && preview.id === c.id
                return (
                  <div
                    key={c.id}
                    onMouseEnter={(ev) => showPreview('call', c.id, ev)}
                    onMouseLeave={hidePreview}
                    className={`px-3 py-2.5 rounded-lg border-l-4 cursor-pointer transition-colors ${
                      c.urgency === 'high' ? 'border-l-red-500' : 'border-l-[#42D1B9]'
                    } ${isActive ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {c.caller_name || t('unknownCaller')}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{c.summary}</p>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{timeAgo(c.called_at)}</span>
                    </div>
                    {c.caller_phone && (
                      <a
                        href={`tel:${c.caller_phone}`}
                        onClick={e => e.stopPropagation()}
                        className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        {c.caller_phone}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <CheckCircle className="w-6 h-6 mx-auto mb-1.5 text-green-500" />
              <p className="text-xs text-[var(--text-muted)]">Ingen akutte henvendelser</p>
            </div>
          )}

        </section>

        {/* ── Kolonne 3: Opgaver ── */}
        <section className="card p-4 flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" />
              {t('tasks')}
            </h2>
            <Link href="/customers" className="text-xs text-[#42D1B9] hover:text-[#56DEC8] hover:underline">{t('viewAll')}</Link>
          </div>
          {tasks.length > 0 ? (
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0">
              {tasks.map(item => (
                <Link
                  key={item.id}
                  href={`/customers/${item.customer_id}`}
                  className={`block px-3 py-2.5 rounded-lg border-l-4 transition-colors hover:bg-[var(--surface-hover)] ${
                    item.status === 'overdue'
                      ? 'border-l-red-500'
                      : item.deadline && new Date(item.deadline).toDateString() === new Date().toDateString()
                        ? 'border-l-amber-400'
                        : 'border-l-slate-300 dark:border-l-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {item.customer_name || 'Kunde'}
                        </p>
                        {item.status === 'overdue' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 flex-shrink-0">
                            {t('overdue')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {item.description || item.action}
                      </p>
                    </div>
                    {item.deadline && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {new Date(item.deadline).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <CheckCircle className="w-6 h-6 mx-auto mb-1.5 text-green-500" />
              <p className="text-xs text-[var(--text-muted)]">Ingen åbne opgaver</p>
            </div>
          )}
        </section>
      </div>

      {/* ── Hover Preview Panel ── */}
      {preview && (previewEmail || previewCall) && (
        <div
          ref={previewRef}
          style={{ top: previewPos.top, left: previewPos.left }}
          className="fixed w-96 max-w-[calc(100vw-2rem)] card shadow-xl z-40 animate-fadeIn"
          onMouseEnter={keepPreview}
          onMouseLeave={hidePreview}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              {preview.type === 'email' ? (
                <Mail className="w-4 h-4 text-red-500" />
              ) : (
                <PhoneIncoming className="w-4 h-4 text-[#42D1B9]" />
              )}
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase">
                {preview.type === 'email' ? 'Mail' : 'Opkald'}
              </span>
            </div>
            <button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-[var(--surface-hover)] transition-colors">
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Email preview */}
          {preview.type === 'email' && previewEmail && (
            <div className="p-4 space-y-3">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{previewEmail.subject || '(Intet emne)'}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Fra: {previewEmail.from_name || previewEmail.from_address}
                </p>
                {previewEmail.received_at && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-xs text-[var(--text-muted)]">
                      Modtaget {timeAgo(previewEmail.received_at)}
                    </span>
                  </div>
                )}
              </div>
              {previewEmailFull?.body_text ? (
                <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {previewEmailFull.body_text.slice(0, 500)}
                  {previewEmailFull.body_text.length > 500 && '...'}
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)] italic">Indlæser indhold...</div>
              )}
              <Link
                href={`/inbox/${previewEmail.id}`}
                className="block text-center text-sm font-medium text-[#42D1B9] hover:text-[#56DEC8] hover:underline py-1"
              >
                Åbn mail →
              </Link>
            </div>
          )}

          {/* Call preview */}
          {preview.type === 'call' && previewCall && (
            <div className="p-4 space-y-3">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {previewCall.caller_name || 'Ukendt opkalder'}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {previewCall.caller_phone && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <Phone className="w-3 h-3" /> {previewCall.caller_phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Clock className="w-3 h-3" /> {timeAgo(previewCall.called_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    previewCall.urgency === 'high'
                      ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      : 'bg-[#42D1B9]/15 text-[#162249] dark:bg-[#42D1B9]/20 dark:text-[#42D1B9]'
                  }`}>
                    {previewCall.urgency === 'high' ? 'Akut' : previewCall.urgency === 'medium' ? 'Medium' : 'Lav'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    previewCall.status === 'new'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                      : previewCall.status === 'contacted'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                  }`}>
                    {previewCall.status === 'new' ? 'Ny' : previewCall.status === 'contacted' ? 'Kontaktet' : 'Løst'}
                  </span>
                </div>
              </div>
              <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg p-3 leading-relaxed">
                {previewCall.summary}
              </div>
              <div className="flex items-center gap-2">
                {previewCall.caller_phone && (
                  <a
                    href={`tel:${previewCall.caller_phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
                  >
                    <Phone className="w-4 h-4" />
                    Ring op
                  </a>
                )}
                <Link
                  href="/ai-secretary"
                  className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--border)] transition-colors min-h-[44px]"
                >
                  Se detaljer →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Stat Box ──────────────────────────────────────────── */

function StatBox({ label, value, color, bg, borderColor }: {
  label: string
  value: number
  color: string
  bg: string
  borderColor: string
}) {
  return (
    <div className={`${bg} ${borderColor} border rounded-xl p-4 text-center`}>
      <p className={`text-3xl md:text-4xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-medium text-[var(--text-muted)] mt-1">{label}</p>
    </div>
  )
}
