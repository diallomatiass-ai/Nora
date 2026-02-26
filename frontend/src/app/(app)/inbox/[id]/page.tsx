'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import EmailDetail from '@/components/EmailDetail'
import AiSuggestionCard from '@/components/AiSuggestionCard'
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

export default function EmailPage() {
  const params = useParams()
  const id = params.id as string
  const { t } = useTranslation()
  const [email, setEmail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  const fetchEmail = async () => {
    try { const data = await api.getEmail(id); setEmail(data) }
    catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchEmail() }, [id])

  const handleAction = async (suggestionId: string, action: string, editedText?: string) => {
    await api.actionSuggestion(suggestionId, action, editedText); await fetchEmail()
  }
  const handleSend = async (suggestionId: string) => {
    await api.sendSuggestion(suggestionId); await fetchEmail()
  }
  const handleGenerate = async () => {
    setGenerating(true)
    try { await api.generateSuggestion(id); await fetchEmail() }
    catch (err: any) { alert(err.message) }
    finally { setGenerating(false) }
  }

  if (loading) return <div className="p-8 text-slate-400 dark:text-zinc-600">{t('loading')}</div>

  if (error || !email) {
    return (
      <div className="p-8">
        <p className="text-red-500 dark:text-red-400">{error || t('emailNotFound')}</p>
        <Link href="/inbox" className="text-[#42D1B9] hover:text-[#56DEC8] text-sm mt-2 inline-block transition-colors">
          {t('backToInbox')}
        </Link>
      </div>
    )
  }

  const hasSuggestions = email.suggestions && email.suggestions.length > 0

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <div className="p-4 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between">
        <Link href="/inbox" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('back')}
        </Link>
        {!hasSuggestions && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Genererer...' : 'Generer AI-forslag'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
          <div className="lg:col-span-2 glass-card p-6">
            <EmailDetail email={email} />
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">{t('aiSuggestions')}</h3>
            {hasSuggestions ? (
              email.suggestions.map((s: any) => (
                <AiSuggestionCard key={s.id} suggestion={s} onAction={handleAction} onSend={handleSend} />
              ))
            ) : (
              <div className="glass-card p-4 text-sm text-slate-400 dark:text-zinc-600">
                <p className="mb-3">{email.processed ? t('noSuggestions') : t('awaitingAi')}</p>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#42D1B9]/15 dark:bg-[#42D1B9]/20 hover:bg-[#42D1B9]/25 text-[#162249] dark:text-[#42D1B9] disabled:opacity-50 transition-colors"
                >
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {generating ? 'Genererer...' : 'Generer AI-forslag nu'}
                </button>
              </div>
            )}
            {email.category && (
              <div className="glass-card p-4">
                <h4 className="text-sm font-medium text-slate-600 dark:text-zinc-400 mb-3">{t('classification')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-zinc-600">{t('category')}</span>
                    <span className="font-medium text-slate-700 dark:text-zinc-300 capitalize">{email.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-zinc-600">{t('priority')}</span>
                    <span className="font-medium text-slate-700 dark:text-zinc-300 capitalize">{email.urgency}</span>
                  </div>
                  {email.topic && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-zinc-600">{t('topic')}</span>
                      <span className="font-medium text-slate-700 dark:text-zinc-300">{email.topic}</span>
                    </div>
                  )}
                  {email.confidence != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-zinc-600">{t('confidence')}</span>
                      <span className="font-medium text-[#42D1B9]">{Math.round(email.confidence * 100)}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
