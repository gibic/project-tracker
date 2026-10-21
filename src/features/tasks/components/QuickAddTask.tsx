'use client'

import { PlusIcon } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { TASK_PRIORITIES } from '@/domain/tasks/task'
import { PRIORITY_LABELS } from '../labels'
import { useTaskMutations } from '../useTaskMutations'

export function QuickAddTask() {
  const formRef = useRef<HTMLFormElement>(null)
  const { create, pending } = useTaskMutations()

  const submit = (formData: FormData) => {
    create(
      { title: formData.get('title'), priority: formData.get('priority'), dueDate: formData.get('dueDate') },
      () => {
        formRef.current?.reset()
        formRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus()
      },
    )
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-wrap gap-2">
      <Input name="title" placeholder="Add a task…" aria-label="Task title" required maxLength={200} className="min-w-48 flex-1" />
      <NativeSelect name="priority" aria-label="Priority" defaultValue="medium" className="w-32">
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </NativeSelect>
      <Input name="dueDate" type="date" aria-label="Due date" className="w-40" />
      <Button type="submit" disabled={pending}>
        <PlusIcon />
        Add
      </Button>
    </form>
  )
}
