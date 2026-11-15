import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '@/application/context'
import type { User } from '@/payload-types'

import { createNote, updateNote } from '@/application/notes/useCases'
import { createProject, setProjectArchived } from '@/application/projects/useCases'
import { search } from '@/application/search/useCases'
import { createTask } from '@/application/tasks/useCases'
import { createAppContext } from '@/infrastructure/container'
import { markdownToLexical } from '@/infrastructure/payload/richText'
import config from '@/payload.config'

/*
 * Postgres full-text search through the real repositories (generated tsvector columns).
 * Point DATABASE_URL at a disposable database: dev mode pushes the schema.
 */

let payload: Payload
const users: User[] = []
let alice: AppContext
let bob: AppContext

const suffix = Date.now()
// A word unique to this run, so leftovers from earlier runs never match.
const word = `zq${suffix.toString(36)}`

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  for (const name of ['alice', 'bob']) {
    users.push(
      await payload.create({
        collection: 'users',
        data: { email: `search-${name}-${suffix}@example.test`, password: 'test-password', name },
      }),
    )
  }
  alice = createAppContext(payload, users[0])
  bob = createAppContext(payload, users[1])
})

afterAll(async () => {
  if (!payload || users.length === 0) return
  const owners = { owner: { in: users.map((u) => u.id) } }
  for (const collection of ['notes', 'tasks', 'projects'] as const) {
    await payload.delete({ collection, where: owners })
  }
  await payload.delete({ collection: 'users', where: { id: { in: users.map((u) => u.id) } } })
})

describe('full-text search', () => {
  it('matches word prefixes in titles, descriptions and note markdown, owner-scoped', async () => {
    const project = await createProject(alice, { name: `${word} Launch`, description: 'Marketing site rollout' })
    const task = await createTask(alice, {
      projectId: project.id,
      title: 'Write copy',
      description: `Planning the ${word} announcement`,
    })
    const note = await createNote(alice, {
      title: 'Retro',
      body: `## Findings\n\nThe **${word}** budget ran over. See [[Launch plan]].`,
    })

    const prefix = word.slice(0, -1)
    const all = await search(alice, { query: prefix })
    expect(all.projects.map((r) => r.project.id)).toEqual([project.id])
    expect(all.tasks.map((r) => r.task.id)).toEqual([task.id])
    expect(all.tasks[0].project).toMatchObject({ id: project.id, status: 'active' })
    expect(all.notes.map((r) => r.note.id)).toEqual([note.id])
    expect(all.notes[0].snippet).toContain(`${word} budget ran over`)
    expect(all.notes[0].snippet).not.toMatch(/[#*[\]]/)

    // Every term must match; English stemming lets "plans" find "Planning".
    expect((await search(alice, { query: `${word} plans` })).tasks).toHaveLength(1)
    expect((await search(alice, { query: `${word} nothing` })).tasks).toHaveLength(0)
    expect(await search(alice, { query: `${word}`, kinds: ['note'] })).toMatchObject({ projects: [], tasks: [] })

    expect(await search(bob, { query: word })).toEqual({ projects: [], tasks: [], notes: [] })
  })

  it('ranks title matches first and reindexes on every save path', async () => {
    const body = await createNote(alice, { title: 'Mentions', body: `${word}rank ${word}rank ${word}rank` })
    const title = await createNote(alice, { title: `${word}rank`, body: 'Short' })
    expect((await search(alice, { query: `${word}rank` })).notes.map((r) => r.note.id)).toEqual([title.id, body.id])

    await updateNote(alice, body.id, { body: 'Nothing left' })
    expect((await search(alice, { query: `${word}rank` })).notes.map((r) => r.note.id)).toEqual([title.id])

    // Admin panel edits skip the use cases; the collection hook still refreshes the indexed text.
    await payload.update({
      collection: 'notes',
      id: Number(body.id),
      data: { content: (await markdownToLexical(payload.config, `Back to ${word}rank`)) as never },
    })
    expect((await search(alice, { query: `${word}rank` })).notes).toHaveLength(2)
  })

  it('includes archived projects and their tasks', async () => {
    const project = await createProject(alice, { name: `${word}arch` })
    await createTask(alice, { projectId: project.id, title: `${word}arch cleanup` })
    await setProjectArchived(alice, project.id, true)

    const results = await search(alice, { query: `${word}arch` })
    expect(results.projects[0].project.status).toBe('archived')
    expect(results.tasks[0].project.status).toBe('archived')
  })
})
