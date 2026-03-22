'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import {
  Plus, FileText, Trash2, ChevronDown, ChevronUp,
  Loader2, CheckCircle, Mic, Square, Send, X,
} from 'lucide-react'

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

interface LiveLine {
  speaker: string
  text: string
  time: string
}

type Mode = 'idle' | 'recording' | 'done'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Nu'
  if (mins < 60) return `${mins}m siden`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}t siden`
  return `${Math.floor(hours / 24)}d siden`
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
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
  const [processing, setProcessing] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Opret-formular (manuel input)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formTranscript, setFormTranscript] = useState('')
  const [formParticipants, setFormParticipants] = useState('')

  // Live optagelse
  const [mode, setMode] = useState<Mode>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [liveLines, setLiveLines] = useState<LiveLine[]>([])
  const [liveActionItems, setLiveActionItems] = useState<string[]>([])
  const [liveKeywords, setLiveKeywords] = useState<string[]>([])
  const [speakerInput, setSpeakerInput] = useState('Mig')
  const [lineInput, setLineInput] = useState('')
  const [newActionItem, setNewActionItem] = useState('')
  const [newKeyword, setNewKeyword] = useState('')

  // Referat
  const [referatTitle, setReferatTitle] = useState('')
  const [referatSummary, setReferatSummary] = useState('')
  const [referatFull, setReferatFull] = useState('')
  const [referatSendTo, setReferatSendTo] = useState('')
  const [referatActions, setReferatActions] = useState<string[]>([])
  const [savingReferat, setSavingReferat] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (mode !== 'recording') return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [mode])

  async function load() {
    setLoading(true)
    try { setMeetings(await api.listMeetings()) } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  function startRecording() {
    setMode('recording')
    setElapsed(0)
    setLiveLines([])
    setLiveActionItems([])
    setLiveKeywords([])
    setStartTime(new Date())
  }

  function stopRecording() {
    const fullText = liveLines.map(l => `[${l.speaker}] ${l.time}: ${l.text}`).join('\n')
    setReferatFull(fullText)
    setReferatSummary(liveActionItems.length > 0 ? liveActionItems.join('\n') : '')
    setReferatActions([...liveActionItems])
    setReferatTitle(`Møde ${new Date().toLocaleDateString('da-DK')}`)
    setMode('done')
  }

  function addLine() {
    if (!lineInput.trim()) return
    const line: LiveLine = { speaker: speakerInput || 'Ukendt', text: lineInput.trim(), time: formatTime(elapsed) }
    setLiveLines(prev => [...prev, line])
    setLineInput('')
  }

  async function handleCreate() {
    if (!formTranscript.trim() && !formTitle.trim()) return
    setCreating(true)
    try {
      const data = await api.createMeeting({
        title: formTitle.trim() || undefined,
        transcript: formTranscript.trim() || undefined,
        participants: formParticipants.trim() || undefined,
      })
      setMeetings(prev => [data, ...prev])
      setShowCreate(false)
      setFormTitle(''); setFormTranscript(''); setFormParticipants('')
    } catch (e) { console.error(e) } finally { setCreating(false) }
  }

  async function handleProcess(id: string) {
    setProcessing(id)
    try { await api.processMeeting(id); await load() } catch (e) { console.error(e) } finally { setProcessing(null) }
  }

  async function handleDelete(id: string) {
    try { await api.deleteMeeting(id); setMeetings(prev => prev.filter(m => m.id !== id)) } catch (e) { console.error(e) }
    setDeleteConfirm(null)
  }

  async function handleSaveReferat(sendMail = false) {
    setSavingReferat(true)
    try {
      const created = await api.createMeeting({
        title: referatTitle || undefined,
        transcript: referatFull || undefined,
        participants: referatSendTo || undefined,
      })
      if (sendMail && referatSendTo.trim()) {
        const res: any = await api.sendReferat(created.id, {
          recipients: referatSendTo.split(',').map((s: string) => s.trim()).filter(Boolean),
          summary: referatSummary,
          action_items: referatActions,
          full_text: referatFull,
        })
        if (res?.mailto) window.open(res.mailto, '_blank')
      }
      setMeetings(prev => [created, ...prev])
      setMode('idle')
    } catch (e) { console.error(e) } finally { setSavingReferat(false) }
  }

  // ── TILSTAND A: Idle ────────────────────────────────────────────────────────
  if (mode === 'idle') return (
    <div className="p-4 md:p-6 space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">Mødenotater</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">AI-transskription → opsummering + handlingspunkter</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" /> Manuel opret
        </button>
      </div>

      {/* Start optagelse */}
      <div className="card p-10 text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#0CA9BA]/10 flex items-center justify-center mx-auto mb-5">
          <Mic className="w-10 h-10 text-[#0CA9BA]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Start møde-optagelse</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
          Virker med Teams, Zoom, Google Meet og alt der kører på din computer
        </p>
        <button
          onClick={startRecording}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#122B4A] dark:bg-[#0CA9BA] text-white font-semibold text-sm hover:bg-[#1a3660] dark:hover:bg-[#3DBFCC] transition-colors"
        >
          <Mic className="w-4 h-4" /> Start optagelse
        </button>
      </div>

      {/* Manuel opret */}
      {showCreate && (
        <div className="card p-5 space-y-4 animate-fadeIn">
          <h2 className="font-semibold text-[var(--text-primary)]">Nyt mødenotat</h2>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Titel (valgfri)</label>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="f.eks. Salgsmøde med Henrik" className="input w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Deltagere (valgfri)</label>
            <input value={formParticipants} onChange={e => setFormParticipants(e.target.value)} placeholder="f.eks. Martin, Henrik, Lars" className="input w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Transskription</label>
            <textarea value={formTranscript} onChange={e => setFormTranscript(e.target.value)} placeholder="Indsæt mødetransskription her..." rows={6} className="input w-full resize-y font-mono text-sm" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors">Annuller</button>
            <button
              onClick={handleCreate}
              disabled={creating || (!formTitle.trim() && !formTranscript.trim())}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#122B4A] dark:bg-[#0CA9BA] text-white font-semibold text-sm hover:bg-[#1a3660] dark:hover:bg-[#3DBFCC] disabled:opacity-50 transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {formTranscript.trim() ? 'Gem & behandl med AI' : 'Gem'}
            </button>
          </div>
        </div>
      )}

      {/* Møde-liste */}
      <div>
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Tidligere møder</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0CA9BA]" /></div>
        ) : meetings.length === 0 ? (
          <div className="card p-10 text-center">
            <FileText className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
            <p className="text-[var(--text-muted)]">Ingen mødenotater endnu</p>
          </div>
        ) : (
          <div className="space-y-2">
            {meetings.map(meeting => {
              const isExpanded = expanded === meeting.id
              const actions = parseActionItems(meeting.action_items)
              return (
                <div key={meeting.id} className="card overflow-hidden">
                  <div className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors" onClick={() => setExpanded(isExpanded ? null : meeting.id)}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[var(--text-primary)] truncate">{meeting.title || 'Mødenotat'}</p>
                        {meeting.summary && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">AI behandlet</span>}
                        {meeting.has_transcript && !meeting.summary && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0CA9BA]/15 text-[#122B4A] dark:text-[#0CA9BA]">Transskription</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                        {meeting.participants && <span>{meeting.participants}</span>}
                        <span>{timeAgo(meeting.created_at)}</span>
                        {actions.length > 0 && <span className="text-amber-600 dark:text-amber-400">{actions.length} handlingspunkter</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {meeting.has_transcript && !meeting.summary && (
                        <button onClick={e => { e.stopPropagation(); handleProcess(meeting.id) }} disabled={processing === meeting.id} className="px-3 py-1.5 rounded-lg bg-[#0CA9BA]/10 hover:bg-[#0CA9BA]/20 text-[#0CA9BA] text-xs font-medium transition-colors">
                          {processing === meeting.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Behandl'}
                        </button>
                      )}
                      {deleteConfirm === meeting.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleDelete(meeting.id)} className="px-2 py-1 rounded text-xs text-white bg-red-600 hover:bg-red-700">Slet</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded text-xs text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">Annuller</button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setDeleteConfirm(meeting.id) }} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-[var(--border)] p-4 space-y-4 animate-fadeIn">
                      {meeting.summary && (
                        <div>
                          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Opsummering</h3>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{meeting.summary}</p>
                        </div>
                      )}
                      {actions.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Handlingspunkter</h3>
                          <ul className="space-y-1.5">
                            {actions.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                                <CheckCircle className="w-4 h-4 text-[#0CA9BA] mt-0.5 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  // ── TILSTAND B: Optager live ─────────────────────────────────────────────────
  if (mode === 'recording') return (
    <div className="p-4 md:p-6 space-y-4 animate-fadeIn">
      {/* Recording header */}
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <span className="font-mono font-bold text-red-600 dark:text-red-400 text-lg">OPTAGER {formatTime(elapsed)}</span>
        <button
          onClick={stopRecording}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          <Square className="w-3.5 h-3.5 fill-current" /> Stop møde
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Venstre: Transcript */}
        <div className="card p-4 space-y-3 flex flex-col">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Live transskription</h3>
          <div className="flex-1 min-h-[200px] max-h-[40vh] overflow-y-auto space-y-2">
            {liveLines.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] italic">Start med at skrive hvad der bliver sagt...</p>
            ) : (
              liveLines.map((line, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold text-[#0CA9BA]">[{line.speaker}]</span>
                  <span className="text-[var(--text-muted)] text-xs ml-1">{line.time}</span>
                  <span className="text-[var(--text-primary)] ml-2">{line.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
            <input
              value={speakerInput}
              onChange={e => setSpeakerInput(e.target.value)}
              placeholder="Deltager"
              className="input w-24 text-sm"
            />
            <input
              value={lineInput}
              onChange={e => setLineInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addLine()}
              placeholder="Hvad der blev sagt... (Enter)"
              className="input flex-1 text-sm"
            />
          </div>
        </div>

        {/* Højre: Action items + keywords */}
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Action items (live)</h3>
            <ul className="space-y-1.5">
              {liveActionItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <CheckCircle className="w-4 h-4 text-[#0CA9BA] flex-shrink-0" />
                  <span className="flex-1">{item}</span>
                  <button onClick={() => setLiveActionItems(prev => prev.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input value={newActionItem} onChange={e => setNewActionItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newActionItem.trim()) { setLiveActionItems(prev => [...prev, newActionItem.trim()]); setNewActionItem('') }}} placeholder="Tilføj action item... (Enter)" className="input flex-1 text-sm" />
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Nøgleord</h3>
            <div className="flex flex-wrap gap-1.5">
              {liveKeywords.map((kw, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#0CA9BA]/10 text-[#0CA9BA] text-xs font-medium">
                  {kw}
                  <button onClick={() => setLiveKeywords(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newKeyword.trim()) { setLiveKeywords(prev => [...prev, newKeyword.trim()]); setNewKeyword('') }}} placeholder="Tilføj nøgleord... (Enter)" className="input flex-1 text-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── TILSTAND C: Referat klar ──────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 animate-fadeIn max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/20">
        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-700 dark:text-green-400">
            Møde afsluttet — {new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}, {formatTime(elapsed)}
          </p>
          <p className="text-sm text-green-600 dark:text-green-500">{liveLines.length} linjer transskriberet</p>
        </div>
        <button onClick={() => setMode('idle')} className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
      </div>

      {/* Titel */}
      <div className="card p-4 space-y-2">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Mødets titel</label>
        <input value={referatTitle} onChange={e => setReferatTitle(e.target.value)} className="input w-full font-semibold" />
      </div>

      {/* Opsummering */}
      <div className="card p-4 space-y-2">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Opsummering</label>
        <textarea value={referatSummary} onChange={e => setReferatSummary(e.target.value)} rows={3} className="input w-full resize-y" />
      </div>

      {/* Action items */}
      <div className="card p-4 space-y-3">
        <label className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Handlingspunkter</label>
        <ul className="space-y-2">
          {referatActions.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#0CA9BA] flex-shrink-0" />
              <input
                value={item}
                onChange={e => setReferatActions(prev => prev.map((a, j) => j === i ? e.target.value : a))}
                className="input flex-1 text-sm"
              />
              <button onClick={() => setReferatActions(prev => prev.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-red-500"><X className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
        <button
          onClick={() => setReferatActions(prev => [...prev, ''])}
          className="text-xs text-[#0CA9BA] hover:underline"
        >+ Tilføj handlingspunkt</button>
      </div>

      {/* Fuld transskription */}
      <div className="card p-4 space-y-2">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Fuld transskription (redigerbar)</label>
        <textarea value={referatFull} onChange={e => setReferatFull(e.target.value)} rows={8} className="input w-full resize-y font-mono text-sm" />
      </div>

      {/* Send til */}
      <div className="card p-4 space-y-2">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Send til (email-adresser, kommasepareret)</label>
        <input value={referatSendTo} onChange={e => setReferatSendTo(e.target.value)} placeholder="mads@firma.dk, lars@firma.dk" className="input w-full" />
      </div>

      {/* Knapper */}
      <div className="flex gap-3">
        <button
          onClick={() => handleSaveReferat(false)}
          disabled={savingReferat}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition-colors"
        >
          {savingReferat ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Gem kun
        </button>
        <button
          onClick={() => handleSaveReferat(true)}
          disabled={savingReferat || !referatSendTo.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#122B4A] dark:bg-[#0CA9BA] text-white text-sm font-semibold hover:bg-[#1a3660] dark:hover:bg-[#3DBFCC] disabled:opacity-50 transition-colors"
        >
          {savingReferat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send referatmail
        </button>
      </div>
    </div>
  )
}
