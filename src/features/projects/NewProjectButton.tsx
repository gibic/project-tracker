'use client'

import { PlusIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ProjectForm } from './ProjectForm'

export function NewProjectButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        New project
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New project">
        <ProjectForm onDone={() => setOpen(false)} />
      </Dialog>
    </>
  )
}
