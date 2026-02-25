'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { X, Minus, Maximize2, Loader2, CheckCircle, Trash2, Sparkles } from 'lucide-react'

interface Props {
  onClose: () => void
  onSent: () => void
}

export default function ComposeEmail({ onClose, onSent }: Props) {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [toAddress, setToAddress] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [minimized, setMinimized] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // AI draft
  const [aiPromptOpen, setAiPromptOpen] = useState(false)
  const [aiInstructions, setAiInstructions] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [selectedTones, setSelectedTones] = useState<string[]>(['professionel'])

  const toneOptions = [
    { id: 'professionel', da: 'Professionel', en: 'Professional' },
    { id: 'venlig', da: 'Venlig', en: 'Friendly' },
    { id: 'uformel', da: 'Uformel', en: 'Casual' },
    { id: 'formel', da: 'Formel', en: 'Formal' },
    { id: 'direkte', da: 'Direkte', en: 'Direct' },
    { id: 'jargon', da: 'Fagsprog', en: 'Jargon' },
  ]

  const toggleTone = (id: string) => {
    setSelectedTones(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  useEffect(() => {
    api.listAccounts().then((accs: any[]) => {
      setAccounts(accs || [])
      if (accs?.length === 1) setAccountId(accs[0].id)
    }).catch(() => {})
  }, [])

  const handleSend = async () => {
    if (!accountId || !toAddress || !subject || !body) return
    setSending(true)
    setError('')
    try {
      await api.composeEmail({ to_address: toAddress, subject, body, account_id: accountId })
      setSent(true)
      setTimeout(() => {
        onSent()
        onClose()
      }, 1200)
    } catch (err: any) {
      setError(err.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleAiDraft = async () => {
    if (!aiInstructions.trim()) return
    setAiGenerating(true)
    setError('')
    try {
      const result = await api.generateComposeDraft({
        instructions: aiInstructions,
        to_address: toAddress || undefined,
        subject: subject || undefined,
        tones: selectedTones.length > 0 ? selectedTones : undefined,
      })
      if (result.body) setBody(result.body)
      if (result.subject && !subject) setSubject(result.subject)
      setAiPromptOpen(false)
      setAiInstructions('')
    } catch (err: any) {
      setError(err.message || 'AI draft failed')
    } finally {
      setAiGenerating(false)
    }
  }

  const isValid = accountId && toAddress.includes('@') && subject.trim() && body.trim()

  // Size classes
  const sizeClass = expanded
    ? 'inset-4 rounded-xl border-b'
    : minimized
      ? 'bottom-0 right-20 w-72 h-auto'
      : 'bottom-0 right-20 w-[680px] h-[75vh]'

  return (
    <div
      className={`fixed z-50 rounded-t-xl border border-b-0 flex flex-col overflow-hidden transition-all
        border-zinc-300 dark:border-zinc-700
        bg-white dark:bg-zinc-900
        shadow-[0_-4px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_-4px_40px_rgba(0,0,0,0.5)]
        ${sizeClass}`}
      style={expanded ? {} : { maxHeight: minimized ? 'auto' : '85vh' }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-700 dark:bg-zinc-800 rounded-t-xl cursor-pointer select-none flex-shrink-0"
        onClick={() => minimized && setMinimized(false)}
      >
        <span className="text-[13px] font-medium text-white truncate">
          {subject || t('newEmail')}
        </span>
        <div className="flex items-center gap-0.5 ml-2">
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); setExpanded(false) }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <Minus className="w-4 h-4 text-zinc-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); setMinimized(false) }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5 text-zinc-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!minimized && (
        <>
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900">
            {/* Account selector */}
            {accounts.length > 1 && (
              <div className="flex items-center px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
                <span className="text-[13px] text-zinc-400 w-10 flex-shrink-0">Fra</span>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="flex-1 text-[13px] bg-transparent text-zinc-900 dark:text-zinc-100 border-none outline-none cursor-pointer"
                >
                  <option value="">{t('selectAccount')}...</option>
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>{acc.email_address}</option>
                  ))}
                </select>
              </div>
            )}

            {/* To field */}
            <div className="flex items-center px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-[13px] text-zinc-400 w-10 flex-shrink-0">{t('toField')}</span>
              <input
                type="email"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="flex-1 text-[13px] bg-transparent text-zinc-900 dark:text-zinc-100 border-none outline-none"
                autoFocus
              />
            </div>

            {/* Subject */}
            <div className="flex items-center px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('subjectField')}
                className="flex-1 text-[13px] bg-transparent text-zinc-900 dark:text-zinc-100 border-none outline-none placeholder:text-zinc-400"
              />
            </div>

            {/* AI Draft prompt */}
            {aiPromptOpen && (
              <div className="px-4 py-3 border-b border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-500 mt-1 flex-shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    {/* Tone pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {toneOptions.map((tone) => {
                        const active = selectedTones.includes(tone.id)
                        return (
                          <button
                            key={tone.id}
                            onClick={() => toggleTone(tone.id)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                              active
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400'
                            }`}
                          >
                            {tone.da}
                          </button>
                        )
                      })}
                    </div>
                    <textarea
                      value={aiInstructions}
                      onChange={(e) => setAiInstructions(e.target.value)}
                      placeholder={t('aiDraftPlaceholder')}
                      rows={2}
                      className="w-full text-[13px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg border border-indigo-200 dark:border-indigo-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 resize-none placeholder:text-zinc-400"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAiDraft()
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAiDraft}
                        disabled={!aiInstructions.trim() || aiGenerating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
                      >
                        {aiGenerating ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />{t('aiDraftGenerating')}</>
                        ) : (
                          <><Sparkles className="w-3 h-3" />{t('aiDraft')}</>
                        )}
                      </button>
                      <button
                        onClick={() => { setAiPromptOpen(false); setAiInstructions('') }}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className={`w-full text-[13px] leading-relaxed bg-transparent text-zinc-900 dark:text-zinc-100 border-none outline-none resize-none ${
                  expanded ? 'min-h-[400px]' : 'min-h-[300px]'
                }`}
              />
            </div>

            {/* Error/success */}
            {error && (
              <div className="px-4 pb-2">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            {sent && (
              <div className="px-4 pb-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                {t('emailSent')}
              </div>
            )}
          </div>

          {/* Footer toolbar */}
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSend}
                disabled={!isValid || sending || sent}
                className="inline-flex items-center gap-1.5 px-5 py-[7px] text-[13px] font-semibold rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors"
              >
                {sending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('sending')}</>
                ) : (
                  t('sendEmail')
                )}
              </button>
              <button
                onClick={() => setAiPromptOpen(!aiPromptOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-medium rounded-full border transition-colors ${
                  aiPromptOpen
                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                    : 'text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t('aiDraft')}
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title={t('delete')}
            >
              <Trash2 className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
