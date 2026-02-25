'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { ChevronDown, ChevronUp, MessageSquare, Clock } from 'lucide-react'

interface Props {
  emailId: string
  onSelect: (id: string) => void
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ConversationPanel({ emailId, onSelect }: Props) {
  const { t } = useTranslation()
  const [thread, setThread] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [threadOpen, setThreadOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getEmailThread(emailId).catch(() => []),
      api.getEmailCustomerHistory(emailId).catch(() => []),
    ]).then(([t, h]) => {
      setThread(t || [])
      setHistory(h || [])
      setLoading(false)
    })
  }, [emailId])

  if (loading) return null

  const hasThread = thread.length > 1
  const hasHistory = history.length > 0

  if (!hasThread && !hasHistory) return null

  return (
    <div className="space-y-3">
      {/* Thread section */}
      {hasThread && (
        <div className="card">
          <button
            onClick={() => setThreadOpen(!threadOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {t('conversationThread')}
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                {thread.length}
              </span>
            </div>
            {threadOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
          {threadOpen && (
            <div className="px-4 pb-3 space-y-1.5">
              {thread.map((email: any) => (
                <button
                  key={email.id}
                  onClick={() => onSelect(email.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    email.id === emailId
                      ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30'
                      : 'hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium truncate ${email.id === emailId ? 'text-blue-700 dark:text-blue-300' : 'text-[var(--text-primary)]'}`}>
                      {email.from_name || email.from_address}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-2 flex-shrink-0">
                      {formatDate(email.received_at)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                    {email.subject || '(intet emne)'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customer history section */}
      {hasHistory && (
        <div className="card">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {t('customerHistory')}
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                {history.length}
              </span>
            </div>
            {historyOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
          {historyOpen && (
            <div className="px-4 pb-3 space-y-1.5">
              {history.map((email: any) => (
                <button
                  key={email.id}
                  onClick={() => onSelect(email.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--text-primary)] truncate">
                      {email.subject || '(intet emne)'}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-2 flex-shrink-0">
                      {formatDate(email.received_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {email.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-muted)] capitalize">
                        {email.category}
                      </span>
                    )}
                    {email.is_replied && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Besvaret</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
