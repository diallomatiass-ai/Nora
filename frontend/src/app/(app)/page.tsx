'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import {
  CheckCircle, Mail, ClipboardList, Clock, X, Sparkles, Calendar,
  ChevronRight, Tag, TrendingUp, Mic, AlertTriangle, Plus,
} from 'lucide-react'

/* ── Types ───────────────────────────────────────────────── */

interface TopEmail {
  id: string
  subject: string
  from_address: string
  from_name: string | null
  urgency: string
  category: string | null
  received_at: string | null
  ai_summary: string | null
  sentiment: string | null
}

interface DashboardData {
  user_name: string
  unread: number
  high_priority: number
  pending_suggestions: number
  week_total: number
  top_urgent: TopEmail[]
  onboarding?: { completed: boolean; steps: { id: string; label: string; done: boolean }[] }
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

interface CalendarEvent {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  event_type: string
}

/* ── Helpers ─────────────────────────────────────────────── */

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
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}t`
  return `${Math.floor(hours / 24)}d`
}

const CATEGORY_LABELS: Record<string, string> = {
  tilbud: 'Tilbud', booking: 'Booking', faktura: 'Faktura',
  reklamation: 'Reklamation', intern: 'Intern', leverandor: 'Leverandør',
  spam: 'Spam', andet: 'Andet', support: 'Support', salg: 'Salg',
}

const CATEGORY_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  tilbud:      { dot: 'bg-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10',   text: 'text-blue-700 dark:text-blue-300' },
  booking:     { dot: 'bg-teal-500',   bg: 'bg-teal-50 dark:bg-teal-500/10',   text: 'text-teal-700 dark:text-teal-300' },
  faktura:     { dot: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300' },
  reklamation: { dot: 'bg-red-500',    bg: 'bg-red-50 dark:bg-red-500/10',     text: 'text-red-700 dark:text-red-300' },
  intern:      { dot: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300' },
  leverandor:  { dot: 'bg-cyan-500',   bg: 'bg-cyan-50 dark:bg-cyan-500/10',   text: 'text-cyan-700 dark:text-cyan-300' },
  spam:        { dot: 'bg-gray-400',   bg: 'bg-gray-100 dark:bg-gray-500/10',  text: 'text-gray-600 dark:text-gray-400' },
  support:     { dot: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-300' },
  salg:        { dot: 'bg-green-500',  bg: 'bg-green-50 dark:bg-green-500/10', text: 'text-green-700 dark:text-green-300' },
  andet:       { dot: 'bg-slate-400',  bg: 'bg-slate-100 dark:bg-slate-500/10', text: 'text-slate-600 dark:text-slate-300' },
}

function CategoryBadge({ cat }: { cat: string | null }) {
  if (!cat) return null
  const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.andet
  const label = CATEGORY_LABELS[cat] ?? cat
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${c.bg} ${c.text}`}>
      {label}
    </span>
  )
}

/* ── Ugekalender mini ────────────────────────────────────── */

function WeekStrip({ events }: { events: CalendarEvent[] }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - today.getDay() + 1 + i) // Man–Søn
    return d
  })

  const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

  const eventsOnDay = (d: Date) =>
    events.filter(e => {
      const ed = new Date(e.start_time)
      return ed.getFullYear() === d.getFullYear() &&
        ed.getMonth() === d.getMonth() &&
        ed.getDate() === d.getDate()
    })

  return (
    <div className="grid grid-cols-7 gap-1 mb-3">
      {days.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString()
        const dayEvents = eventsOnDay(d)
        return (
          <div
            key={i}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-colors ${
              isToday
                ? 'bg-[#0CA9BA]/15 ring-1 ring-[#0CA9BA]/40'
                : 'hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span className="text-[10px] font-medium text-[var(--text-muted)]">{dayNames[i]}</span>
            <span className={`text-xs font-bold ${isToday ? 'text-[#0CA9BA]' : 'text-[var(--text-primary)]'}`}>
              {d.getDate()}
            </span>
            {dayEvents.length > 0 && (
              <div className="flex gap-0.5 flex-wrap justify-center">
                {dayEvents.slice(0, 3).map((_, j) => (
                  <div key={j} className="w-1.5 h-1.5 rounded-full bg-[#0CA9BA]" />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main Dashboard ──────────────────────────────────────── */

export default function Dashboard() {
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [emailStats, setEmailStats] = useState<{ categories: Record<string, number>; urgency: Record<string, number> } | null>(null)
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [calConnected, setCalConnected] = useState(false)
  const { t } = useTranslation()

  // Hover preview
  const [preview, setPreview] = useState<{ type: 'email'; id: string } | null>(null)
  const [previewPos, setPreviewPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [emailDetail, setEmailDetail] = useState<Record<string, any>>({})
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getDashboardSummary().then(setDash).catch(console.error)
    api.getEmailStats().then(setEmailStats).catch(console.error)

    // Kalender: hent events for denne uge
    const from = new Date()
    from.setDate(from.getDate() - from.getDay() + 1)
    const to = new Date(from)
    to.setDate(from.getDate() + 6)
    api.getCalendarStatus().then((s: any) => {
      setCalConnected(s?.connected ?? false)
    }).catch(() => {})
    api.listCalendarEvents({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }).then(setCalEvents).catch(() => setCalEvents([]))

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
      const panelW = 384
      const spaceRight = window.innerWidth - rect.right
      const fromRight = spaceRight < panelW + 16
      const left = fromRight ? Math.max(8, rect.left - panelW - 8) : rect.right + 8
      const top = Math.min(Math.max(8, rect.top - 40), window.innerHeight - 400)
      setPreviewPos({ top, left })
      setPreview({ type: 'email', id })
      if (!emailDetail[id]) {
        api.getEmail(id).then(data => setEmailDetail(prev => ({ ...prev, [id]: data }))).catch(() => {})
      }
    }, 280)
  }, [emailDetail])

  const hidePreview = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    hoverTimeout.current = setTimeout(() => setPreview(null), 200)
  }, [])

  const keepPreview = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
  }, [])

  const urgentCount = dash?.high_priority ?? 0
  const newCount = dash?.unread ?? 0
  const openTasks = tasks.length
  const allEmails = dash?.top_urgent ?? []
  const previewEmail = preview ? allEmails.find(e => e.id === preview.id) : null
  const previewEmailFull = preview ? emailDetail[preview.id] : null

  // Kategorier sorteret efter antal
  const sortedCategories = emailStats
    ? Object.entries(emailStats.categories).sort((a, b) => b[1] - a[1])
    : []
  const totalEmails = sortedCategories.reduce((s, [, v]) => s + v, 0)

  // Møder denne uge
  const todayEvents = calEvents.filter(e => new Date(e.start_time).toDateString() === new Date().toDateString())
  const upcomingEvents = calEvents.filter(e => new Date(e.start_time) >= new Date()).slice(0, 5)

  // AI dagsoverblik
  function aiSummary(): string {
    if (!dash) return ''
    const parts: string[] = []
    if (urgentCount > 0) parts.push(`${urgentCount} mail${urgentCount !== 1 ? 's' : ''} kræver svar`)
    const overdue = tasks.filter(t => t.status === 'overdue').length
    if (overdue > 0) parts.push(`${overdue} overskredet opgave${overdue !== 1 ? 'r' : ''}`)
    if (todayEvents.length > 0) parts.push(`${todayEvents.length} møde${todayEvents.length !== 1 ? 'r' : ''} i dag`)
    return parts.length === 0 ? 'Alt er under kontrol — nyd dagen 🎉' : parts.join(' · ') + '.'
  }

  return (
    <div className="p-4 md:p-6 space-y-5 relative animate-fadeIn">

      {/* Hilsen */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
          {dash ? greeting(dash.user_name) : 'Dashboard'}
        </h1>
      </div>

      {/* AI summary */}
      {dash && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#0CA9BA]/8 border border-[#0CA9BA]/20">
          <div className="p-1 rounded bg-[#0CA9BA]/15 flex-shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-[#0CA9BA]" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{aiSummary()}</p>
        </div>
      )}

      {/* Stat-bokse */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/inbox?urgency=high">
          <StatBox label="Akutte" value={urgentCount} icon={AlertTriangle}
            color="text-red-700 dark:text-red-400" bg="bg-red-50 dark:bg-red-500/10"
            border="border-red-200 dark:border-red-500/20" />
        </Link>
        <Link href="/inbox">
          <StatBox label="Nye mails" value={newCount} icon={Mail}
            color="text-[#162249] dark:text-[#42D1B9]" bg="bg-[#42D1B9]/10"
            border="border-[#42D1B9]/20" />
        </Link>
        <Link href="/customers">
          <StatBox label="Opgaver" value={openTasks} icon={ClipboardList}
            color="text-amber-700 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-500/10"
            border="border-amber-200 dark:border-amber-500/20" />
        </Link>
        <Link href="/calendar">
          <StatBox label="Møder i dag" value={todayEvents.length} icon={Calendar}
            color="text-[#0CA9BA]" bg="bg-[#0CA9BA]/10"
            border="border-[#0CA9BA]/20" />
        </Link>
      </div>

      {/* Onboarding */}
      {dash?.onboarding && !dash.onboarding.completed && (
        <section className="card p-4 border-l-4 border-l-[#42D1B9]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#42D1B9]" />
              Kom godt i gang
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              {dash.onboarding.steps.filter(s => s.done).length}/{dash.onboarding.steps.length}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {dash.onboarding.steps.map(step => (
              <div key={step.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                step.done ? 'bg-[#42D1B9]/10 text-[#42D1B9]' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
              }`}>
                <CheckCircle className={`w-4 h-4 flex-shrink-0 ${step.done ? 'text-[#42D1B9]' : 'text-[var(--border)]'}`} />
                <span className="truncate">{step.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hoved-grid: 3 kolonner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Mails der haster ── */}
        <section className="card p-4 flex flex-col max-h-[420px] lg:col-span-1">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              Mails der haster
            </h2>
            <Link href="/inbox?urgency=high" className="text-xs text-[#42D1B9] hover:underline flex items-center gap-0.5">
              Se alle <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {allEmails.length > 0 ? (
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0">
              {allEmails.map(e => {
                const isActive = preview?.id === e.id
                return (
                  <div
                    key={e.id}
                    onMouseEnter={(ev) => showPreview(e.id, ev)}
                    onMouseLeave={hidePreview}
                    className={`relative px-3 py-2.5 rounded-lg transition-all border-l-4 cursor-pointer group ${
                      e.urgency === 'high' ? 'border-l-red-500' : 'border-l-amber-400'
                    } ${isActive ? 'bg-[var(--surface-hover)] shadow-sm' : 'hover:bg-[var(--surface-hover)] hover:shadow-sm'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {e.subject || '(Intet emne)'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{e.from_name || e.from_address}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {e.received_at && (
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                            {timeAgo(e.received_at)}
                          </span>
                        )}
                        <CategoryBadge cat={e.category} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center flex-1">
              <CheckCircle className="w-7 h-7 mx-auto mb-2 text-green-500" />
              <p className="text-xs text-[var(--text-muted)]">Ingen akutte mails</p>
            </div>
          )}
        </section>

        {/* ── Email kategorier ── */}
        <section className="card p-4 flex flex-col max-h-[420px]">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4" />
              Email kategorier
            </h2>
            <Link href="/inbox" className="text-xs text-[#42D1B9] hover:underline flex items-center gap-0.5">
              Indbakke <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {sortedCategories.length > 0 ? (
            <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
              {sortedCategories.map(([cat, count]) => {
                const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.andet
                const pct = totalEmails > 0 ? Math.round((count / totalEmails) * 100) : 0
                return (
                  <Link
                    key={cat}
                    href={`/inbox?category=${cat}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-all group cursor-pointer"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {CATEGORY_LABELS[cat] ?? cat}
                        </span>
                        <span className="text-xs font-bold text-[var(--text-secondary)]">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${c.dot}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center flex-1">
              <TrendingUp className="w-7 h-7 mx-auto mb-2 text-[var(--text-muted)]" />
              <p className="text-xs text-[var(--text-muted)]">Ingen emails endnu</p>
            </div>
          )}

          {/* Urgency summary */}
          {emailStats && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] flex gap-3 flex-shrink-0">
              {[
                { label: 'Høj', key: 'high', color: 'text-red-600 bg-red-50 dark:bg-red-500/10' },
                { label: 'Middel', key: 'medium', color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
                { label: 'Lav', key: 'low', color: 'text-green-600 bg-green-50 dark:bg-green-500/10' },
              ].map(u => (
                <div key={u.key} className={`flex-1 text-center py-1.5 rounded-lg ${u.color}`}>
                  <div className="text-sm font-bold">{emailStats.urgency[u.key] ?? 0}</div>
                  <div className="text-[10px] font-medium">{u.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Kalender & Opgaver ── */}
        <section className="card p-4 flex flex-col max-h-[420px]">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-xs font-bold text-[#0CA9BA] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Kalender
            </h2>
            <Link href="/calendar" className="text-xs text-[#42D1B9] hover:underline flex items-center gap-0.5">
              Åbn <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Ugekort */}
          <WeekStrip events={calEvents} />

          {/* Kommende events / tom kalender */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
            {!calConnected ? (
              <div className="py-4 text-center">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-[var(--text-muted)]" />
                <p className="text-xs text-[var(--text-muted)] mb-2">Kalender ikke tilsluttet</p>
                <Link
                  href="/settings?tab=mailkonti"
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#0CA9BA]/10 text-[#0CA9BA] hover:bg-[#0CA9BA]/20 transition-colors font-medium"
                >
                  <Plus className="w-3 h-3" />
                  Tilslut Gmail / Outlook
                </Link>
              </div>
            ) : upcomingEvents.length > 0 ? (
              upcomingEvents.map(ev => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors group"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0CA9BA] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{ev.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(ev.start_time).toLocaleString('da-DK', {
                        weekday: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-center">
                <CheckCircle className="w-6 h-6 mx-auto mb-1.5 text-green-500" />
                <p className="text-xs text-[var(--text-muted)]">Ingen kommende møder</p>
              </div>
            )}
          </div>

          {/* Mødenotater genvej */}
          <Link
            href="/meetings"
            className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[#0CA9BA] transition-colors flex-shrink-0 group"
          >
            <Mic className="w-3.5 h-3.5 group-hover:text-[#0CA9BA]" />
            Mødenotater & AI-transskription
            <ChevronRight className="w-3 h-3 ml-auto" />
          </Link>
        </section>
      </div>

      {/* Opgaver-sektion */}
      {tasks.length > 0 && (
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" />
              Åbne opgaver
            </h2>
            <Link href="/customers" className="text-xs text-[#42D1B9] hover:underline flex items-center gap-0.5">
              Se alle <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {tasks.slice(0, 6).map(item => (
              <Link
                key={item.id}
                href={`/customers/${item.customer_id}`}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border-l-4 transition-all hover:bg-[var(--surface-hover)] hover:shadow-sm group ${
                  item.status === 'overdue' ? 'border-l-red-500' :
                  item.deadline && new Date(item.deadline).toDateString() === new Date().toDateString()
                    ? 'border-l-amber-400' : 'border-l-slate-300 dark:border-l-slate-600'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {item.customer_name || 'Kunde'}
                    </p>
                    {item.status === 'overdue' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 flex-shrink-0">
                        Overskredet
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] truncate">{item.description || item.action}</p>
                  {item.deadline && (
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(item.deadline).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Hover Preview Panel */}
      {preview && previewEmail && (
        <div
          ref={previewRef}
          style={{ top: previewPos.top, left: previewPos.left }}
          className="fixed w-96 max-w-[calc(100vw-2rem)] card shadow-2xl z-40 animate-fadeIn border border-[var(--border)]"
          onMouseEnter={keepPreview}
          onMouseLeave={hidePreview}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-red-500" />
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Forhåndsvisning</span>
              <CategoryBadge cat={previewEmail.category} />
              {previewEmail.sentiment && previewEmail.sentiment !== 'neutral' && (
                <span className="text-sm">{previewEmail.sentiment === 'positive' ? '😊' : '😟'}</span>
              )}
            </div>
            <button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-[var(--surface-hover)] transition-colors">
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{previewEmail.subject || '(Intet emne)'}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Fra: {previewEmail.from_name || previewEmail.from_address}</p>
              {previewEmail.received_at && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-muted)]">Modtaget {timeAgo(previewEmail.received_at)} siden</span>
                </div>
              )}
            </div>
            {previewEmail.ai_summary && (
              <p className="text-sm text-[var(--text-secondary)] italic border-l-2 border-[#42D1B9]/50 pl-3">
                {previewEmail.ai_summary}
              </p>
            )}
            {previewEmailFull?.body_text ? (
              <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {previewEmailFull.body_text.slice(0, 500)}
                {previewEmailFull.body_text.length > 500 && '...'}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)] italic animate-pulse">Indlæser indhold...</div>
            )}
            <Link
              href={`/inbox/${previewEmail.id}`}
              className="flex items-center justify-center gap-1 text-sm font-medium text-white bg-[#42D1B9] hover:bg-[#38b9a3] rounded-lg py-2 transition-colors"
            >
              Åbn og svar <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Stat Box ──────────────────────────────────────────── */

function StatBox({ label, value, icon: Icon, color, bg, border }: {
  label: string; value: number; icon: any; color: string; bg: string; border: string
}) {
  return (
    <div className={`${bg} ${border} border rounded-xl p-4 text-center hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer`}>
      <div className="flex justify-center mb-1.5">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className={`text-3xl md:text-4xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-medium text-[var(--text-muted)] mt-1">{label}</p>
    </div>
  )
}
