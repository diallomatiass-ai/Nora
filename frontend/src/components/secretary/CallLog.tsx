'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { api } from '@/lib/api'
import Link from 'next/link'
import { Phone, MapPin, Clock, ChevronDown, ChevronUp, MessageSquare, CheckCircle, Users } from 'lucide-react'

interface Call {
  id: string
  caller_name: string | null
  caller_phone: string | null
  caller_address: string | null
  summary: string
  transcript: string | null
  urgency: string
  status: string
  notes: string | null
  called_at: string
  customer_id?: string | null
  confirmation_sent_at?: string | null
}

interface CallLogProps {
  calls: Call[]
  onCallUpdated: () => void
  onPushOrdrestyring?: (customerId: string) => void
}

const urgencyTranslation: Record<string, string> = {
  high: 'urgencyHigh',
  medium: 'urgencyMedium',
  low: 'urgencyLow',
}

const statusTranslation: Record<string, string> = {
  new: 'statusNew',
  contacted: 'statusContacted',
  resolved: 'statusResolved',
}

export default function CallLog({ calls, onCallUpdated, onPushOrdrestyring }: CallLogProps) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handleStatusChange = async (callId: string, newStatus: string) => {
    try {
      await api.updateCallStatus(callId, { status: newStatus })
      onCallUpdated()
    } catch (err) {
      console.error('Failed to update call status:', err)
    }
  }

  const handleSaveNotes = async (callId: string) => {
    const notes = editingNotes[callId]
    if (notes === undefined) return
    try {
      await api.updateCallStatus(callId, { notes })
      onCallUpdated()
    } catch (err) {
      console.error('Failed to save notes:', err)
    }
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>{t('noCalls')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => {
        const isExpanded = expandedId === call.id
        const isUrgent = call.urgency === 'high'
        const isNew = call.status === 'new'

        return (
          <div
            key={call.id}
            className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-colors ${
              isUrgent ? 'border-l-urgent' : isNew ? 'border-l-new' : ''
            }`}
          >
            {/* Header row */}
            <button
              onClick={() => toggleExpand(call.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--surface-hover)] transition-colors min-h-[56px]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {call.caller_name || 'Ukendt'}
                  </span>
                  {isUrgent && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                      {t((urgencyTranslation[call.urgency]) as any)}
                    </span>
                  )}
                  {call.status !== 'resolved' && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      call.status === 'new'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                    }`}>
                      {t((statusTranslation[call.status] || 'statusNew') as any)}
                    </span>
                  )}
                  {call.status === 'resolved' && (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <p className="text-sm text-[var(--text-muted)] truncate">
                  {call.summary}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-[var(--text-muted)]">
                  {formatTime(call.called_at)}
                </span>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" /> : <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />}
              </div>
            </button>

            {/* Quick actions — altid synlige for nye/akutte opkald */}
            {!isExpanded && (call.status === 'new' || isUrgent) && (
              <div className="flex items-center gap-2 px-4 pb-3">
                {call.caller_phone && (
                  <a
                    href={`tel:${call.caller_phone}`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
                  >
                    <Phone className="w-4 h-4" />
                    {t('callBack')}
                  </a>
                )}
                {call.status === 'new' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(call.id, 'contacted') }}
                    className="px-4 py-2 rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)] text-sm font-medium hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 transition-colors min-h-[44px]"
                  >
                    {t('markedContacted')}
                  </button>
                )}
                {call.customer_id && onPushOrdrestyring && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPushOrdrestyring(call.customer_id!) }}
                    className="px-4 py-2 rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)] text-sm font-medium hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 transition-colors min-h-[44px]"
                  >
                    → Ordrestyring
                  </button>
                )}
              </div>
            )}

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-[var(--border)] pt-4 space-y-4">
                {/* Contact info + Ring op */}
                <div className="flex flex-wrap items-center gap-3">
                  {call.caller_phone && (
                    <>
                      <a
                        href={`tel:${call.caller_phone}`}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
                      >
                        <Phone className="w-4 h-4" />
                        {t('callBack')} {call.caller_phone}
                      </a>
                    </>
                  )}
                  {call.caller_address && (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                      {call.caller_address}
                    </div>
                  )}
                </div>

                {/* Customer link + Ordrestyring */}
                {call.customer_id && (
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/customers/${call.customer_id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      {t('viewCustomer')}
                    </Link>
                    {onPushOrdrestyring && (
                      <button
                        onClick={() => onPushOrdrestyring(call.customer_id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 transition-colors"
                      >
                        → Ordrestyring
                      </button>
                    )}
                  </div>
                )}

                {/* Confirmation badge */}
                {call.confirmation_sent_at && (
                  <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    {t('confirmationSent')}
                  </div>
                )}

                {/* Summary */}
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">
                    {t('callSummary')}
                  </h4>
                  <p className="text-sm text-[var(--text-primary)]">{call.summary}</p>
                </div>

                {/* Transcript */}
                {call.transcript && (
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">
                      {t('callTranscript')}
                    </h4>
                    <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {call.transcript}
                    </div>
                  </div>
                )}

                {/* Status buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase mr-1">
                    {t('callStatus')}:
                  </span>
                  {['new', 'contacted', 'resolved'].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(call.id, s)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                        call.status === s
                          ? s === 'new'
                            ? 'bg-blue-600 text-white'
                            : s === 'contacted'
                            ? 'bg-amber-500 text-white'
                            : 'bg-green-600 text-white'
                          : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                      }`}
                    >
                      {t((statusTranslation[s] || s) as any)}
                    </button>
                  ))}
                </div>

                {/* Notes */}
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t('callNotes')}
                  </h4>
                  <textarea
                    value={editingNotes[call.id] ?? call.notes ?? ''}
                    onChange={(e) => setEditingNotes({ ...editingNotes, [call.id]: e.target.value })}
                    onBlur={() => handleSaveNotes(call.id)}
                    rows={2}
                    placeholder="Tilføj noter..."
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[44px]"
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
