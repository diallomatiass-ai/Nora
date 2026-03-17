'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Plus, FileText, Trash2, ChevronDown, ChevronUp, Loader2, CheckCircle } from 'lucide-react'

interface MeetingNote {
  id: string
  title: string | null
  summary: string | null
  action_items: string | null
  participants: string | null
  meeting_date: string | null
  created_at: string
  has_transcript: boolean
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

function parseActionItems(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {}
  return raw.split('\n').filter(Boolean)
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingNote[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [participants, setParticipants] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await api.listMeetings()
      setMeetings(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!transcript.trim() && !title.trim()) return
    setCreating(true)
    try {
      const data = await api.createMeeting({
        title: title.trim() || undefined,
        transcript: transcript.trim() || undefined,
        participants: participants.trim() || undefined,
      })
      setMeetings(prev => [data, ...prev])
      setShowCreate(false)
      setTitle('')
      setTranscript('')
      setParticipants('')
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  async function handleProcess(id: string) {
    setProcessing(id)
    try {
      await api.processMeeting(id)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setProcessing(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Slet dette mødenotat?')) return
    try {
      await api.deleteMeeting(id)
      setMeetings(prev => prev.filter(m => m.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">Mødenotater</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">AI-behandlet transskription → sammenfatning + handlingspunkter</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#42D1B9] hover:bg-[#38BCA7] text-white font-semibold text-sm transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Nyt møde
        </button>
      </div>

      {/* Opret-formular */}
      {showCreate && (
        <div className="card p-5 space-y-4 animate-fadeIn">
          <h2 className="font-semibold text-[var(--text-primary)]">Nyt mødenotat</h2>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Titel (valgfri — AI foreslår hvis tom)</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="f.eks. Salgsmøde med Henrik"
              className="input w-full"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Deltagere (valgfri)</label>
            <input
              value={participants}
              onChange={e => setParticipants(e.target.value)}
              placeholder="f.eks. Martin, Henrik, Lars"
              className="input w-full"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Transskription</label>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Indsæt mødetransskription her..."
              rows={8}
              className="input w-full resize-y font-mono text-sm"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Annuller
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || (!title.trim() && !transcript.trim())}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#42D1B9] hover:bg-[#38BCA7] text-white font-semibold text-sm transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {transcript.trim() ? 'Gem & behandl med AI' : 'Gem'}
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#42D1B9]" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="card p-10 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)]">Ingen mødenotater endnu</p>
          <p className="text-sm text-[var(--text-muted)] mt-1 opacity-70">Opret et nyt møde for at komme i gang</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map(meeting => {
            const isExpanded = expanded === meeting.id
            const actions = parseActionItems(meeting.action_items)
            return (
              <div key={meeting.id} className="card overflow-hidden">
                {/* Header row */}
                <div
                  className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : meeting.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[var(--text-primary)] truncate">
                        {meeting.title || 'Mødenotat'}
                      </p>
                      {meeting.has_transcript && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#42D1B9]/15 text-[#162249] dark:text-[#42D1B9]">
                          Transskription
                        </span>
                      )}
                      {meeting.summary && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">
                          AI behandlet
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                      {meeting.participants && <span>{meeting.participants}</span>}
                      <span>{timeAgo(meeting.created_at)}</span>
                      {actions.length > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">{actions.length} handlingspunkter</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {meeting.has_transcript && !meeting.summary && (
                      <button
                        onClick={e => { e.stopPropagation(); handleProcess(meeting.id) }}
                        disabled={processing === meeting.id}
                        className="px-3 py-1.5 rounded-lg bg-[#42D1B9]/10 hover:bg-[#42D1B9]/20 text-[#42D1B9] text-xs font-medium transition-colors"
                      >
                        {processing === meeting.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Behandl'}
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(meeting.id) }}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] p-4 space-y-4 animate-fadeIn">
                    {meeting.summary && (
                      <div>
                        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Sammenfatning</h3>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{meeting.summary}</p>
                      </div>
                    )}
                    {actions.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Handlingspunkter</h3>
                        <ul className="space-y-1.5">
                          {actions.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                              <CheckCircle className="w-4 h-4 text-[#42D1B9] mt-0.5 flex-shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!meeting.summary && !meeting.has_transcript && (
                      <p className="text-sm text-[var(--text-muted)] italic">Ingen indhold endnu.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
