'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import {
  ArrowLeft, Mail, Phone, MapPin, Edit2, Check, X, Plus,
  Clock, ClipboardList, TrendingUp, Trash2,
} from 'lucide-react'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  estimated_value: number | null
  tags: string[]
  source: string | null
  notes: string | null
  address_street: string | null
  address_zip: string | null
  address_city: string | null
  created_at: string
}

interface ActionItem {
  id: string
  action: string
  description: string | null
  deadline: string | null
  status: string
  created_at: string
}

interface TimelineItem {
  id: string
  event_type: string
  description: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  ny_henvendelse: 'Ny',
  kontaktet: 'Kontaktet',
  tilbud_sendt: 'Tilbud sendt',
  tilbud_accepteret: 'Accepteret',
  afsluttet: 'Afsluttet',
  tilbud_afvist: 'Afvist',
  arkiveret: 'Arkiveret',
}

const STATUS_COLORS: Record<string, string> = {
  ny_henvendelse: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  kontaktet: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  tilbud_sendt: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  tilbud_accepteret: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  afsluttet: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
  tilbud_afvist: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  arkiveret: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20 dark:text-slate-500',
}

const TASK_ACTIONS = ['Ring tilbage', 'Send tilbud', 'Send info', 'Book tid', 'Opfølgning', 'Andet']

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useTranslation()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [tasks, setTasks] = useState<ActionItem[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [editingStatus, setEditingStatus] = useState(false)

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskAction, setTaskAction] = useState(TASK_ACTIONS[0])
  const [taskDesc, setTaskDesc] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [c, tl, ai] = await Promise.all([
          api.getCustomer(id),
          api.getCustomerTimeline(id).catch(() => []),
          api.listActionItems({ customer_id: id }),
        ])
        setCustomer(c)
        setNotesValue(c.notes || '')
        setTimeline(tl)
        setTasks(ai)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function saveNotes() {
    if (!customer) return
    await api.updateCustomer(id, { notes: notesValue })
    setCustomer(c => c ? { ...c, notes: notesValue } : c)
    setEditingNotes(false)
  }

  async function updateStatus(status: string) {
    await api.updateCustomer(id, { status })
    setCustomer(c => c ? { ...c, status } : c)
    setEditingStatus(false)
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    setCreatingTask(true)
    try {
      await api.createActionItem({
        customer_id: id,
        action: taskAction,
        description: taskDesc || undefined,
        deadline: taskDeadline || undefined,
      })
      const updated = await api.listActionItems({ customer_id: id })
      setTasks(updated)
      setTaskDesc('')
      setTaskDeadline('')
      setShowTaskForm(false)
    } catch {
      // silent
    } finally {
      setCreatingTask(false)
    }
  }

  async function markTaskDone(taskId: string) {
    await api.updateActionItem(taskId, { status: 'completed' })
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: 'completed' } : t))
  }

  async function deleteTask(taskId: string) {
    await api.deleteActionItem(taskId)
    setTasks(ts => ts.filter(t => t.id !== taskId))
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-[var(--surface-hover)] rounded" />
        <div className="card p-6 h-40 bg-[var(--surface-hover)]" />
        <div className="card p-6 h-60 bg-[var(--surface-hover)]" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <p className="text-[var(--text-muted)]">Kunde ikke fundet</p>
        <Link href="/customers" className="mt-2 inline-block text-[#42D1B9] hover:underline text-sm">← Tilbage til kunder</Link>
      </div>
    )
  }

  const openTasks = tasks.filter(t => t.status !== 'completed')
  const doneTasks = tasks.filter(t => t.status === 'completed')

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fadeIn max-w-3xl">
      {/* Back */}
      <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[#42D1B9] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Alle kunder
      </Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#42D1B9]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-[#42D1B9]">{customer.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{customer.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {editingStatus ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={customer.status}
                      onChange={e => updateStatus(e.target.value)}
                      className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-sm"
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button onClick={() => setEditingStatus(false)}>
                      <X className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingStatus(true)}
                    className={`px-2.5 py-1 rounded text-xs font-bold ${STATUS_COLORS[customer.status] || 'bg-slate-100 text-slate-600'} hover:opacity-80 transition-opacity`}
                  >
                    {STATUS_LABELS[customer.status] || customer.status} ✏
                  </button>
                )}
                {customer.estimated_value ? (
                  <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {customer.estimated_value.toLocaleString('da-DK')} kr
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors group">
              <Mail className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#42D1B9]" />
              <span className="text-sm text-[var(--text-secondary)] group-hover:text-[#42D1B9]">{customer.email}</span>
            </a>
          )}
          {customer.phone && (
            <a href={`tel:${customer.phone}`} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors group">
              <Phone className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#42D1B9]" />
              <span className="text-sm text-[var(--text-secondary)] group-hover:text-[#42D1B9]">{customer.phone}</span>
            </a>
          )}
          {(customer.address_street || customer.address_city) && (
            <div className="flex items-center gap-2 px-3 py-2">
              <MapPin className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              <span className="text-sm text-[var(--text-secondary)]">
                {[customer.address_street, customer.address_zip, customer.address_city].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {customer.source && (
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs text-[var(--text-muted)]">Kilde: {customer.source}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{t('notes')}</h2>
          {!editingNotes && (
            <button onClick={() => setEditingNotes(true)} className="p-1.5 rounded hover:bg-[var(--surface-hover)]">
              <Edit2 className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              rows={4}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={saveNotes}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#42D1B9] text-white text-sm font-medium"
              >
                <Check className="w-4 h-4" /> Gem
              </button>
              <button
                onClick={() => { setEditingNotes(false); setNotesValue(customer.notes || '') }}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)]"
              >
                Annuller
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
            {customer.notes || <span className="text-[var(--text-muted)] italic">Ingen noter endnu. Klik ✏ for at tilføje.</span>}
          </p>
        )}
      </div>

      {/* Tasks */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-amber-500" />
            {t('tasks')}
            {openTasks.length > 0 && (
              <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
                {openTasks.length}
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowTaskForm(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#42D1B9]/10 text-[#42D1B9] text-xs font-semibold hover:bg-[#42D1B9]/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Opret opgave
          </button>
        </div>

        {showTaskForm && (
          <form onSubmit={createTask} className="mb-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Handling</label>
                <select
                  value={taskAction}
                  onChange={e => setTaskAction(e.target.value)}
                  className="w-full px-2 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none"
                >
                  {TASK_ACTIONS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Deadline</label>
                <input
                  type="date"
                  value={taskDeadline}
                  onChange={e => setTaskDeadline(e.target.value)}
                  className="w-full px-2 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none"
                />
              </div>
            </div>
            <input
              value={taskDesc}
              onChange={e => setTaskDesc(e.target.value)}
              placeholder="Beskrivelse (valgfri)"
              className="w-full px-2 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creatingTask}
                className="px-3 py-1.5 rounded bg-[#42D1B9] text-white text-xs font-semibold disabled:opacity-50"
              >
                {creatingTask ? 'Opretter...' : 'Gem'}
              </button>
              <button
                type="button"
                onClick={() => setShowTaskForm(false)}
                className="px-3 py-1.5 rounded border border-[var(--border)] text-xs text-[var(--text-muted)]"
              >
                Annuller
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {openTasks.map(task => (
            <div key={task.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-hover)] group">
              <button
                onClick={() => markTaskDone(task.id)}
                className="mt-0.5 w-4 h-4 rounded-full border-2 border-[var(--border)] hover:border-[#42D1B9] flex-shrink-0 transition-colors"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">{task.action}</p>
                {task.description && <p className="text-xs text-[var(--text-muted)] truncate">{task.description}</p>}
                {task.deadline && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(task.deadline).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          ))}
          {openTasks.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] italic py-2">Ingen åbne opgaver</p>
          )}
          {doneTasks.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)] select-none">
                {doneTasks.length} udførte opgaver
              </summary>
              <div className="mt-2 space-y-1">
                {doneTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-50">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-[var(--text-muted)] line-through">{task.action}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">{t('customerTimeline')}</h2>
          <div className="space-y-3">
            {timeline.map((item, i) => (
              <div key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-[#42D1B9] mt-1.5 flex-shrink-0" />
                  {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-[var(--border)] mt-1" />}
                </div>
                <div className="pb-3 min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">{item.description}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {new Date(item.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
