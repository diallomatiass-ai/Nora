'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import {
  CheckCircle, Mail, ClipboardList, Clock, X,
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

interface OnboardingStep {
  id: string
  label: string
  done: boolean
}

interface DashboardData {
  user_name: string
  unread: number
  high_priority: number
  pending_suggestions: number
  week_total: number
  top_urgent: TopEmail[]
  onboarding?: {
    completed: boolean
    steps: OnboardingStep[]
  }
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
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const { t } = useTranslation()

  // Hover preview state
  const [preview, setPreview] = useState<{ type: 'email'; id: string } | null>(null)
  const [previewPos, setPreviewPos] = useState<{ top: number; left: number; fromRight: boolean }>({ top: 0, left: 0, fromRight: false })
  const [emailDetail, setEmailDetail] = useState<Record<string, any>>({})
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getDashboardSummary().then(setDash).catch(console.error)
    // Hent alle åbne opgaver (overdue + pending), sorteret med overdue først
    Promise.all([
      api.listActionItems({ status: 'overdue' }),
      api.listActionItems({ status: 'pending' }),
    ]).then(([overdue, pending]: [TaskItem[], TaskItem[]]) => {
      setTasks([...overdue, ...pending])
    }).catch(console.error)
  }, [])

  const showPreview = useCallback((id: string, e: React.MouseEvent) => {
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
      setPreview({ type: 'email', id })
      // Hent email-detaljer on-demand
      if (!emailDetail[id]) {
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
  const urgentCount = dash?.high_priority ?? 0
  const newCount = dash?.unread ?? 0
  const openTasks = tasks.length

  // ── Data til kolonner (urgent først, API sorterer allerede) ──
  const allEmails = dash?.top_urgent ?? []
  const previewEmail = preview ? allEmails.find(e => e.id === preview.id) : null
  const previewEmailFull = preview ? emailDetail[preview.id] : null

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

      {/* Onboarding-checklist (kun når ikke færdig) */}
      {dash?.onboarding && !dash.onboarding.completed && (
        <section className="card p-4 border-l-4 border-l-[#42D1B9]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#42D1B9]" />
              Kom godt i gang
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              {dash.onboarding.steps.filter(s => s.done).length}/{dash.onboarding.steps.length} gennemført
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {dash.onboarding.steps.map(step => (
              <div key={step.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${step.done ? 'bg-[#42D1B9]/10 text-[#42D1B9]' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'}`}>
                <CheckCircle className={`w-4 h-4 flex-shrink-0 ${step.done ? 'text-[#42D1B9]' : 'text-[var(--border)]'}`} />
                <span className="truncate">{step.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2 Kolonner + hover preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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
                    onMouseEnter={(ev) => showPreview(e.id, ev)}
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

        {/* ── Kolonne 2: Opgaver ── */}
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
      {preview && previewEmail && (
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
              <Mail className="w-4 h-4 text-red-500" />
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase">Mail</span>
            </div>
            <button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-[var(--surface-hover)] transition-colors">
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Email preview */}
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
