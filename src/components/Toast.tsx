import { useEffect } from 'react'

export interface ToastItem {
  id: string
  message: string
  tone: 'success' | 'error' | 'info'
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3200)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const toneStyles = {
    success: 'border-teal-700/30 before:bg-teal-700',
    error: 'border-red-500/30 before:bg-red-500',
    info: 'border-slate-400/30 before:bg-slate-500',
  }[toast.tone]

  return (
    <div
      role="status"
      className={`relative overflow-hidden rounded-lg border bg-white/95 px-4 py-3 pl-5 text-sm text-ink shadow-card backdrop-blur before:absolute before:left-0 before:top-0 before:h-full before:w-1 dark:bg-teal-900/95 dark:text-paper ${toneStyles} animate-[toast-in_0.2s_ease-out]`}
    >
      {toast.message}
    </div>
  )
}
