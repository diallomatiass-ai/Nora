'use client'

import { useTranslation } from '@/lib/i18n'

const categoryColors: Record<string, string> = {
  inquiry: 'bg-[#42D1B9]/10 text-[#162249] dark:text-[#42D1B9]',
  complaint: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',
  order: 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400',
  support: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
  spam: 'bg-slate-100 dark:bg-zinc-700/50 text-slate-500 dark:text-zinc-500',
  other: 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400',
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
}

interface Props { emails: Email[]; onSelect: (id: string) => void; selectedId?: string }

export default function InboxList({ emails, onSelect, selectedId }: Props) {
  const { t, locale } = useTranslation()

  if (emails.length === 0) {
    return <div className="p-8 text-center text-slate-400 dark:text-zinc-600">{t('noEmails')}</div>
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
      {emails.map((email) => (
        <button
          key={email.id}
          onClick={() => onSelect(email.id)}
          className={`w-full text-left px-4 py-3 transition-all duration-200 flex items-start gap-3 ${
            selectedId === email.id
              ? 'bg-[#42D1B9]/10 border-l-2 border-l-[#42D1B9]'
              : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] border-l-2 border-l-transparent'
          }`}
        >
          <div className="pt-1.5 flex-shrink-0">
            {!email.is_read ? (
              <div className="w-2.5 h-2.5 rounded-full bg-[#42D1B9] animate-pulse-glow" />
            ) : (
              <div className="w-2.5 h-2.5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-slate-900 dark:text-zinc-100' : 'text-slate-500 dark:text-zinc-400'}`}>
                {email.from_name || email.from_address}
              </span>
              <span className="text-xs text-slate-400 dark:text-zinc-600 flex-shrink-0">{timeAgo(email.received_at, locale)}</span>
            </div>
            <p className={`text-sm truncate mt-0.5 ${!email.is_read ? 'font-medium text-slate-700 dark:text-zinc-300' : 'text-slate-400 dark:text-zinc-500'}`}>
              {email.subject || t('noSubject')}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              {email.category && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[email.category] || categoryColors.other}`}>
                  {email.category}
                </span>
              )}
              {email.urgency && <div className={`w-2 h-2 rounded-full ${urgencyDots[email.urgency] || ''}`} />}
              {email.has_suggestion && <span className="text-xs text-[#42D1B9] font-medium">AI</span>}
              {email.is_replied && <span className="text-xs text-green-600 dark:text-green-400">{t('replied')}</span>}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
