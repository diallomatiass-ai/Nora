'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

interface Template {
  id: string
  name: string
  category: string | null
  body: string
  usage_count: number
}

export default function TemplatesPage() {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', category: '', body: '' })

  const categoryLabels: Record<string, string> = {
    inquiry: t('inquiry'),
    complaint: t('complaint'),
    order: t('order'),
    support: t('support'),
    other: t('other'),
  }

  const fetchTemplates = async () => {
    try {
      const data = await api.listTemplates()
      setTemplates(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTemplates() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editId) {
        await api.updateTemplate(editId, {
          name: form.name,
          category: form.category || undefined,
          body: form.body,
        })
      } else {
        await api.createTemplate({
          name: form.name,
          category: form.category || undefined,
          body: form.body,
        })
      }
      setForm({ name: '', category: '', body: '' })
      setShowForm(false)
      setEditId(null)
      fetchTemplates()
    } catch (err) {
      console.error(err)
    }
  }

  const handleEdit = (tmpl: Template) => {
    setForm({ name: tmpl.name, category: tmpl.category || '', body: tmpl.body })
    setEditId(tmpl.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteTemplate'))) return
    await api.deleteTemplate(id)
    fetchTemplates()
  }

  return (
    <div className="p-8 max-w-4xl animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{t('templates')}</h1>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', category: '', body: '' }) }}
          className="flex items-center gap-1.5 btn-primary px-4 py-2 text-sm"
        >
          <Plus className="w-4 h-4" /> {t('newTemplate')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-4">
            {editId ? t('editTemplate') : t('newTemplate')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('name')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('category')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-dark"
              >
                <option value="">{t('none')}</option>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('content')}</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              rows={6}
              className="input-dark resize-y"
            />
          </div>
          <div className="flex gap-2">
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
      ) : templates.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-400 dark:text-zinc-600">
          {t('noTemplates')}
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="glass-card p-4 group hover:border-slate-300 dark:hover:border-white/[0.12] transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-slate-800 dark:text-zinc-200">{tmpl.name}</h3>
                    {tmpl.category && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                        {tmpl.category}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 dark:text-zinc-600">{t('used')} {tmpl.usage_count}x</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-500 line-clamp-2">{tmpl.body}</p>
                </div>
                <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(tmpl)} className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-[#42D1B9] transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(tmpl.id)} className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
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
