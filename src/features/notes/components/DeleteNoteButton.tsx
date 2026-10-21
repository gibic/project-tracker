'use client'

import { Trash2Icon } from 'lucide-react'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { deleteNoteAction } from '../actions'

export function DeleteNoteButton({ id, title }: { id: string; title: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete "${title}"?`)) return
        startTransition(async () => {
          const result = await deleteNoteAction(id)
          if (result && !result.ok) alert(result.error)
        })
      }}
    >
      <Trash2Icon />
      Delete
    </Button>
  )
}
