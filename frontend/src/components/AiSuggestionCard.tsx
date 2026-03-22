'use client'

import { useState } from 'react'
import { Bot, Check, Pencil, X, Send, MessageSquare, Loader2, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import ReplyEditor from './ReplyEditor'
import { useTranslation } from '@/lib/i18n'

interface Suggestion {
  id: string
  suggested_text: string
  status: string
  edited_text: string | null
  sent_at: string | null
}

interface Props {
  suggestion: Suggestion
  onAction: (id: string, action: string, editedText?: string) => Promise<void>
  onSend: (id: string) => Promise<void>
}

export default function AiSuggestionCard({ suggestion, onAction, onSend }: Props) {
  const { t, locale } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatPrompt, setChatPrompt] = useState('')
  const [refining, setRefining] = useState(false)
  const [refinedText, setRefinedText] = useState<string | null>(null)

  const handleAction = async (action: string, editedText?: string) => {
    setLoading(true)
    try { await onAction(suggestion.id, action, editedText); setEditing(false) } finally { setLoading(false) }
  }

  const handleSend = async () => {
    setLoading(true)
    try { await onSend(suggestion.id) } finally { setLoading(false) }
  }

  const handleRefine = async () => {
    if (!chatPrompt.trim()) return
    setRefining(true)
    try {
      const currentText = refinedText || suggestion.edited_text || suggestion.suggested_text
      const res = await api.refineSuggestion(suggestion.id, chatPrompt.trim(), currentText)
      setRefinedText(res.refined_text)
      setChatPrompt('')
    } catch (err) {
      console.error('Refine failed:', err)
    } finally {
      setRefining(false)
    }
  }

  const handleApplyRefined = async () => {
    if (!refinedText) return
    await handleAction('edit', refinedText)
    setRefinedText(null)
    setChatOpen(false)
  }

  const displayText = refinedText || suggestion.edited_text || suggestion.suggested_text

  return (
    <div className="border-l-4 border-l-[#0CA9BA] border border-[#0CA9BA]/25 rounded-xl bg-[var(--surface)] shadow-[var(--shadow-ai)] p-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#0CA9BA]/10">
            <Bot className="w-4 h-4 text-[#0CA9BA]" />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">✨ Noras forslag</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400">
            97%
          </span>
          {suggestion.status !== 'pending' && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              suggestion.status === 'approved' ? 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400' :
              suggestion.status === 'edited' ? 'bg-[#0CA9BA]/10 text-[#122B4A] dark:text-[#0CA9BA]' :
              'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400'
            }`}>
              {suggestion.status === 'approved' ? t('approved') :
               suggestion.status === 'edited' ? t('edited') : t('rejected')}
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <ReplyEditor
          initialText={suggestion.suggested_text}
          onSave={(text) => handleAction('edit', text)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {/* Svartekst */}
          <div className="bg-[var(--brand-teal-soft)] dark:bg-[#0CA9BA]/5 border border-[#0CA9BA]/20 rounded-lg p-4 mb-3">
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{displayText}</p>
          </div>

          {/* Knapper */}
          <div className="flex items-center gap-2 flex-wrap">
            {suggestion.status === 'pending' && (
              <>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg border border-[var(--border)] disabled:opacity-50 transition-all"
                >
                  <X className="w-3.5 h-3.5" /> {t('reject')}
                </button>
                <button
                  onClick={() => setEditing(true)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] disabled:opacity-50 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" /> {t('edit')}
                </button>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={loading}
                  className="flex items-center gap-1.5 ml-auto px-5 py-2 text-sm font-semibold text-white bg-[#122B4A] dark:bg-[#0CA9BA] rounded-lg hover:bg-[#1a3660] dark:hover:bg-[#3DBFCC] disabled:opacity-50 transition-all"
                >
                  <Check className="w-4 h-4" /> {t('approve')}
                </button>
              </>
            )}

            {(suggestion.status === 'approved' || suggestion.status === 'edited') && !suggestion.sent_at && (
              <button
                onClick={handleSend}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#122B4A] dark:bg-[#0CA9BA] rounded-lg hover:bg-[#1a3660] dark:hover:bg-[#3DBFCC] disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('sendReply')}
              </button>
            )}

            {suggestion.status === 'pending' && (
              <button
                onClick={() => setChatOpen(!chatOpen)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#0CA9BA] bg-[#0CA9BA]/10 border border-[#0CA9BA]/25 rounded-lg hover:bg-[#0CA9BA]/20 disabled:opacity-50 transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" /> {t('refineWithAi')}
              </button>
            )}

            {suggestion.sent_at && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                {t('sent')} {new Date(suggestion.sent_at).toLocaleString(locale === 'da' ? 'da-DK' : 'en-US')}
              </span>
            )}
          </div>

          {/* AI Raffinering */}
          {chatOpen && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#0CA9BA]" />
                <span className="text-xs font-medium text-[#0CA9BA]">{t('refineTitle')}</span>
              </div>
              {refinedText && (
                <div className="bg-[#0CA9BA]/8 border border-[#0CA9BA]/20 rounded-lg p-3 mb-3">
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{refinedText}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleApplyRefined}
                      disabled={loading}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-md hover:bg-green-100 dark:hover:bg-green-500/20 transition-all"
                    >
                      <Check className="w-3 h-3" /> {t('apply')}
                    </button>
                    <button
                      onClick={() => setRefinedText(null)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-[var(--text-muted)] bg-[var(--surface-hover)] border border-[var(--border)] rounded-md hover:bg-[var(--surface-hover)] transition-all"
                    >
                      <X className="w-3 h-3" /> {t('discard')}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleRefine()}
                  placeholder={t('refinePlaceholder')}
                  disabled={refining}
                  className="flex-1 input text-sm disabled:opacity-50"
                />
                <button
                  onClick={handleRefine}
                  disabled={refining || !chatPrompt.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#0CA9BA] bg-[#0CA9BA]/10 border border-[#0CA9BA]/25 rounded-lg hover:bg-[#0CA9BA]/20 disabled:opacity-50 transition-all"
                >
                  {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{t('refineHint')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
