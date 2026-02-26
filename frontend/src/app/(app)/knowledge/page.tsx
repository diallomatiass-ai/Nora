'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

interface KnowledgeEntry {
  id: string
  entry_type: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

const allTypes = ['faq', 'pricing', 'hours', 'tone']

export default function KnowledgePage() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<string>('faq')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ entry_type: 'faq', title: '', content: '' })

  const typeLabels: Record<string, string> = {
    faq: t('faq'),
    pricing: t('pricing'),
    hours: t('hours'),
    tone: t('tone'),
  }

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const data = await api.listKnowledge(activeType)
      setEntries(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEntries() }, [activeType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editId) {
        await api.updateKnowledge(editId, form)
      } else {
        await api.createKnowledge(form)
      }
      setForm({ entry_type: activeType, title: '', content: '' })
      setShowForm(false)
      setEditId(null)
      fetchEntries()
    } catch (err) {
      console.error(err)
    }
  }

  const handleEdit = (entry: KnowledgeEntry) => {
    setForm({ entry_type: entry.entry_type, title: entry.title, content: entry.content })
    setEditId(entry.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteEntry'))) return
    await api.deleteKnowledge(id)
    fetchEntries()
  }

  return (
    <div className="p-8 max-w-4xl animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#42D1B9]/10">
            <BookOpen className="w-5 h-5 text-[#42D1B9]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{t('knowledgeBase')}</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ entry_type: activeType, title: '', content: '' }) }}
          className="flex items-center gap-1.5 btn-primary px-4 py-2 text-sm"
        >
          <Plus className="w-4 h-4" /> {t('newEntry')}
        </button>
      </div>

      <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">
        {t('knowledgeDesc')}
      </p>

      {/* Type tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-white/[0.06]">
        {allTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeType === type
                ? 'border-[#42D1B9] text-[#162249] dark:text-[#42D1B9]'
                : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
            }`}
          >
            {typeLabels[type]}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-4">
            {editId ? t('editEntry') : t('newEntry')}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('type')}</label>
              <select
                value={form.entry_type}
                onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
                className="input-dark"
              >
                {allTypes.map((tp) => (
                  <option key={tp} value={tp}>{typeLabels[tp]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('title')}</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('content')}</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
                rows={5}
                className="input-dark resize-y"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              {editId ? t('save') : t('create')}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditId(null) }}
              className="px-4 py-2 text-sm text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200 transition-all"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-400 dark:text-zinc-600">{t('loading')}</p>
      ) : entries.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-400 dark:text-zinc-600">
          {typeLabels[activeType]?.toLowerCase()} — {t('noEntries')}
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="glass-card p-4 group hover:border-slate-300 dark:hover:border-white/[0.12] transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-slate-800 dark:text-zinc-200 mb-1">{entry.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-500 whitespace-pre-wrap">{entry.content}</p>
                </div>
                <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(entry)} className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-[#42D1B9] transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
