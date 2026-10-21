'use client'

import { cn } from '@/utilities/ui'
import { XIcon } from 'lucide-react'
import * as React from 'react'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

/** Modal built on the native <dialog> element (focus trap, Esc and backdrop handled by the browser). */
const Dialog: React.FC<DialogProps> = ({ open, onClose, title, children, className }) => {
  const ref = React.useRef<HTMLDialogElement>(null)

  React.useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50',
        className,
      )}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export { Dialog }
