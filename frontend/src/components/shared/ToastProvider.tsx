import { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react'

export interface Toast {
  id: string
  type: 'hot_alert' | 'replied' | 'campaign' | 'sync' | 'info'
  title: string
  message: string
  duration?: number
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS: Record<Toast['type'], string> = {
  hot_alert: '🔥',
  replied: '💬',
  campaign: '📣',
  sync: '🔄',
  info: 'ℹ️',
}

const COLORS: Record<Toast['type'], string> = {
  hot_alert: 'border-l-red-500 bg-red-50',
  replied: 'border-l-green-500 bg-green-50',
  campaign: 'border-l-blue-500 bg-blue-50',
  sync: 'border-l-purple-500 bg-purple-50',
  info: 'border-l-gray-500 bg-gray-50',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(toast.id), toast.duration ?? 5000)
    return () => clearTimeout(timerRef.current)
  }, [toast.id, toast.duration, onRemove])

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border border-gray-200 border-l-4 max-w-sm w-full ${COLORS[toast.type]} animate-slide-in`}
      onClick={() => onRemove(toast.id)}
      style={{ cursor: 'pointer' }}
    >
      <span className="text-xl shrink-0 mt-0.5">{ICONS[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{toast.message}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(toast.id) }}
        className="text-gray-400 hover:text-gray-600 shrink-0 text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]) // max 5 toasts
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
