'use client'

import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, X, Sparkles } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => remove(id), 3500)
  }, [remove])

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast])
  const error = useCallback((msg: string) => toast(msg, 'error'), [toast])
  const warning = useCallback((msg: string) => toast(msg, 'warning'), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-[var(--shadow-lg)] bg-[var(--surface)] border border-[var(--border)] min-w-[280px] max-w-[380px] animate-[fadeSlideIn_0.22s_ease-out]"
          >
            {t.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
            {t.type === 'error' && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
            {t.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
            {t.type === 'info' && <Sparkles className="w-5 h-5 text-[#0CA9BA] flex-shrink-0" />}
            <span className="text-sm text-[var(--text-primary)] flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
