'use client'

import { useTranslation } from '@/lib/i18n'

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500',
  'bg-teal-500', 'bg-green-500', 'bg-indigo-500', 'bg-red-500',
]

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function getAvatarColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const categoryColors: Record<string, string> = {
  // Danske kategorier
  tilbud: 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400',
  booking: 'bg-[#42D1B9]/10 text-[#162249] dark:text-[#42D1B9]',
  faktura: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  reklamation: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',
  intern: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  leverandor: 'bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400',
  support: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
  spam: 'bg-slate-100 dark:bg-zinc-700/50 text-slate-500 dark:text-zinc-500',
  andet: 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400',
  // Legacy
  inquiry: 'bg-[#42D1B9]/10 text-[#162249] dark:text-[#42D1B9]',
  complaint: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',
  order: 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400',
  other: 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400',
}

const categoryLabels: Record<string, string> = {
  tilbud: 'Tilbud', booking: 'Booking', faktura: 'Faktura',
  reklamation: 'Reklamation', intern: 'Intern', leverandor: 'Leverandør',
  support: 'Support', spam: 'Spam', andet: 'Andet',
  inquiry: 'Henvendelse', complaint: 'Klage', order: 'Ordre', other: 'Andet',
}

const sentimentDot: Record<string, string> = {
  positive: 'text-green-500',
  neutral: 'text-slate-400',
  negative: 'text-red-400',
}

const sentimentIcon: Record<string, string> = {
  positive: '😊', neutral: '😐', negative: '😟',
}

const urgencyDots: Record<string, string> = {
  high: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]',
  medium: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]',
  low: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]',
}

function timeAgo(dateStr: string | null, locale: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return locale === 'da' ? 'Nu' : 'Now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return locale === 'da' ? `${hours}t` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

interface Email {
  id: string; from_address: string; from_name: string | null; subject: string | null
  received_at: string | null; is_read: boolean; is_replied: boolean
  category: string | null; urgency: string | null; has_suggestion: boolean
  ai_summary: string | null; sentiment: string | null; is_starred: boolean
}

interface Props { emails: Email[]; onSelect: (id: string) => void; selectedId?: string }

export default function InboxList({ emails, onSelect, selectedId }: Props) {
  const { t, locale } = useTranslation()

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center mb-3">
          <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-[var(--text-primary)]">Indbakken er ryddet</p>
        <p className="text-sm text-[var(--text-muted)] mt-1">Nyd det 🎉</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      {emails.map((email) => {
        const initials = getInitials(email.from_name, email.from_address)
        const avatarColor = getAvatarColor(email.from_address)
        return (
        <button
          key={email.id}
          onClick={() => onSelect(email.id)}
          className={`w-full text-left px-3 py-3 transition-all duration-[120ms] flex items-center gap-3 hover:translate-x-0.5 ${
            selectedId === email.id
              ? 'bg-[#0CA9BA]/10 border-l-2 border-l-[#0CA9BA]'
              : !email.is_read
              ? 'border-l-2 border-l-[#0CA9BA] hover:bg-[var(--surface-hover)]'
              : 'border-l-2 border-l-transparent hover:bg-[var(--surface-hover)]'
          }`}
        >
          {/* Avatar */}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {email.from_name || email.from_address}
              </span>
              <span className="text-xs text-slate-400 dark:text-zinc-600 flex-shrink-0">{timeAgo(email.received_at, locale)}</span>
            </div>
            <p className={`text-sm truncate mt-0.5 ${!email.is_read ? 'font-medium text-slate-700 dark:text-zinc-300' : 'text-slate-400 dark:text-zinc-500'}`}>
              {email.subject || t('noSubject')}
            </p>
            {email.ai_summary && (
              <p className="text-xs text-[var(--text-muted)] truncate mt-0.5 italic">
                {email.ai_summary}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {email.category && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[email.category] || categoryColors.andet}`}>
                  {categoryLabels[email.category] || email.category}
                </span>
              )}
              {email.urgency && <div className={`w-2 h-2 rounded-full ${urgencyDots[email.urgency] || ''}`} />}
              {email.sentiment && email.sentiment !== 'neutral' && (
                <span className="text-xs" title={email.sentiment}>{sentimentIcon[email.sentiment]}</span>
              )}
              {email.has_suggestion && <span className="text-xs text-[#42D1B9] font-medium">AI</span>}
              {email.is_starred && <span className="text-xs text-amber-400">★</span>}
              {email.is_replied && <span className="text-xs text-green-600 dark:text-green-400">{t('replied')}</span>}
            </div>
          </div>
        </button>
        )
      })}
    </div>
  )
}
