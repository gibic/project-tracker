import { createMcpHandler } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import { createMcpServer } from '@/features/mcp/server'
import { createInMemoryContext } from './inMemoryContext'

/** Drives the MCP server over its real HTTP handler, backed by in-memory repositories. */
const setup = () => {
  const env = createInMemoryContext()
  const handler = createMcpHandler(() => createMcpServer(env.ctx))
  let seq = 0

  const rpc = async (method: string, params: Record<string, unknown> = {}) => {
    const response = await handler.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-11-25',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
      }),
    )
    const raw = await response.text()
    // Responses may be framed as SSE (`data: {...}`) or plain JSON.
    const json = raw.startsWith('{') ? raw : raw.split('\n').find((l) => l.startsWith('data:'))!.slice(5)
    return JSON.parse(json)
  }

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const { result, error } = await rpc('tools/call', { name, arguments: args })
    if (error) throw new Error(error.message)
    const text: string = result.content[0].text
    return { isError: Boolean(result.isError), text, data: result.isError ? null : tryJson(text) }
  }

  return { ...env, rpc, call }
}

const tryJson = (text: string) => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

describe('mcp server', () => {
  it('lists the tools', async () => {
    const { rpc } = setup()
    const { result } = await rpc('tools/list')
    const names = result.tools.map((t: { name: string }) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['create_project', 'create_task', 'move_task', 'create_note', 'update_note', 'get_dashboard']),
    )
  })

  it('creates a project, tasks and a linked note', async () => {
    const { call } = setup()
    const project = (await call('create_project', { name: 'Launch', color: 'sky' })).data
    const task = (await call('create_task', { projectId: project.id, title: 'Ship', dueDate: '2026-10-25' })).data
    expect(task).toMatchObject({ status: 'todo', priority: 'medium', dueDate: '2026-10-25T12:00:00.000Z' })

    const done = (await call('update_task', { taskId: task.id, status: 'done' })).data
    expect(done).toMatchObject({ title: 'Ship', status: 'done' })
    expect(done.completedAt).not.toBeNull()

    const note = (await call('create_note', { title: 'Plan', body: 'See [[Ship log]]', taskIds: [task.id] })).data
    const edited = (await call('update_note', { noteId: note.id, tags: ['Launch Plan'] })).data
    expect(edited).toMatchObject({ title: 'Plan', taskIds: [task.id], tags: ['launch-plan'] })

    const detail = (await call('get_note', { noteId: note.id })).data
    expect(detail.note.body).toBe('See [[Ship log]]')
    expect(detail.html).toBeUndefined()
    expect(detail.wikiLinks).toEqual([{ title: 'Ship log', noteId: null }])

    const board = (await call('get_project', { projectId: project.id })).data
    expect(board.project.progress).toMatchObject({ done: 1, total: 1 })
    expect(board.notesByTask[task.id].map((n: { title: string }) => n.title)).toEqual(['Plan'])
  })

  it('returns business-rule failures as tool errors', async () => {
    const { call } = setup()
    const project = (await call('create_project', { name: 'Old' })).data
    await call('set_project_archived', { projectId: project.id, archived: true })

    const result = await call('create_task', { projectId: project.id, title: 'Nope' })
    expect(result).toMatchObject({ isError: true, text: expect.stringMatching(/archived/) })
    expect(await call('get_note', { noteId: '404' })).toMatchObject({ isError: true, text: 'Note 404 was not found' })
  })
})
