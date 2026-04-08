"use client"

import { X, AlertTriangle } from "lucide-react"
import { Button } from "./Button"

type ConfirmModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning"
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Bevestigen",
  cancelText = "Annuleren",
  variant = "danger"
}: ConfirmModalProps) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${
              variant === "danger" 
                ? "bg-red-100 dark:bg-red-900/30" 
                : "bg-amber-100 dark:bg-amber-900/30"
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                variant === "danger"
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message */}
        <p className="mb-6 text-slate-600 dark:text-slate-400">
          {message}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {cancelText}
          </Button>
          <Button 
            onClick={handleConfirm}
            className={
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            }
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
