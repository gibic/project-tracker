import { McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { AppContext } from '@/application/context'

import { getDashboard } from '@/application/dashboard/getDashboard'
import { createNote, deleteNote, getNote, listNotes, listTags, updateNote } from '@/application/notes/useCases'
import {
  createProject,
  deleteProject,
  getProjectBoard,
  listProjects,
  setProjectArchived,
  updateProject,
} from '@/application/projects/useCases'
import { createTask, deleteTask, moveTask, updateTask } from '@/application/tasks/useCases'
import { PROJECT_COLORS } from '@/domain/projects/project'
import { isDomainError } from '@/domain/shared/errors'
import { TASK_PRIORITIES, TASK_STATUSES } from '@/domain/tasks/task'

/*
 * MCP tools for LLM agents. Every tool calls an application use case, so agents get
 * the same rules as the workspace UI (owner scoping, archived projects, completedAt,
 * unique note titles, wiki-link keys). Results are JSON text; dates are ISO strings.
 */

const INSTRUCTIONS = `Personal project tracker and knowledge base.
- Projects contain tasks. Task status is one of: ${TASK_STATUSES.join(', ')}. Archived projects are read-only until restored.
- Notes are markdown. Link other notes with [[Note Title]]; titles are unique (case-insensitive). Notes can reference projects and tasks by id.
- Use get_project to see a project's tasks and notes, get_dashboard for overdue / due-soon / in-progress work.`

const id = (entity: string) => z.string().min(1).describe(`${entity} id`)
const projectColor = z.enum(PROJECT_COLORS)
const taskStatus = z.enum(TASK_STATUSES)
const taskPriority = z.enum(TASK_PRIORITIES)
const dueDate = z.string().describe('Calendar day as YYYY-MM-DD')
const tags = z.array(z.string()).describe('Tags; normalized to lowercase kebab-case')

const READ = { readOnlyHint: true, openWorldHint: false } as const
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const

const text = (value: string): CallToolResult => ({ content: [{ type: 'text', text: value }] })

/** Runs a use case and turns business-rule failures into tool errors the agent can act on. */
const run = async (execute: () => Promise<unknown>): Promise<CallToolResult> => {
  try {
    const result = await execute()
    return text(result === undefined ? 'Done.' : JSON.stringify(result, null, 2))
  } catch (error) {
    if (isDomainError(error)) return { ...text(error.message), isError: true }
    console.error('[mcp]', error)
    return { ...text('Unexpected server error.'), isError: true }
  }
}

export const createMcpServer = (ctx: AppContext): McpServer => {
  const server = new McpServer({ name: 'project-tracker', version: '1.0.0' }, { instructions: INSTRUCTIONS })

  // Dashboard

  server.registerTool(
    'get_dashboard',
    {
      title: 'Dashboard',
      description: 'Active projects with progress, overdue / due-soon / in-progress tasks, recent notes and totals.',
      annotations: READ,
    },
    () => run(() => getDashboard(ctx)),
  )

  // Projects

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'Lists projects with task progress. Archived projects are excluded unless includeArchived is true.',
      inputSchema: z.object({ includeArchived: z.boolean().optional() }),
      annotations: READ,
    },
    ({ includeArchived }) => run(() => listProjects(ctx, { includeArchived })),
  )

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description: 'A project with its tasks (board order), its notes, and notes attached to each task.',
      inputSchema: z.object({ projectId: id('Project') }),
      annotations: READ,
    },
    ({ projectId }) => run(() => getProjectBoard(ctx, projectId)),
  )

  server.registerTool(
    'create_project',
    {
      title: 'Create project',
      inputSchema: z.object({
        name: z.string().max(80),
        description: z.string().max(2000).optional(),
        color: projectColor.optional().describe('Defaults to slate'),
      }),
      annotations: WRITE,
    },
    (input) => run(() => createProject(ctx, input)),
  )

  server.registerTool(
    'update_project',
    {
      title: 'Update project',
      description: 'Changes name, description or color. Omitted fields keep their current value.',
      inputSchema: z.object({
        projectId: id('Project'),
        name: z.string().max(80).optional(),
        description: z.string().max(2000).optional(),
        color: projectColor.optional(),
      }),
      annotations: WRITE,
    },
    ({ projectId, ...patch }) => run(() => updateProject(ctx, projectId, patch)),
  )

  server.registerTool(
    'set_project_archived',
    {
      title: 'Archive or restore project',
      description: 'Archived projects are hidden from the dashboard and their tasks cannot change.',
      inputSchema: z.object({ projectId: id('Project'), archived: z.boolean() }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ projectId, archived }) => run(() => setProjectArchived(ctx, projectId, archived)),
  )

  server.registerTool(
    'delete_project',
    {
      title: 'Delete project',
      description: 'Permanently deletes the project and all its tasks. Notes are kept but detached.',
      inputSchema: z.object({ projectId: id('Project') }),
      annotations: DESTRUCTIVE,
    },
    ({ projectId }) => run(() => deleteProject(ctx, projectId)),
  )

  // Tasks

  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description: 'Adds a task to the bottom of its status column. The project must be active.',
      inputSchema: z.object({
        projectId: id('Project'),
        title: z.string().max(200),
        description: z.string().max(5000).optional(),
        status: taskStatus.optional().describe('Defaults to todo'),
        priority: taskPriority.optional().describe('Defaults to medium'),
        dueDate: dueDate.optional(),
      }),
      annotations: WRITE,
    },
    (input) => run(() => createTask(ctx, input)),
  )

  server.registerTool(
    'update_task',
    {
      title: 'Update task',
      description:
        'Changes task fields. Omitted fields keep their current value; dueDate null clears it. ' +
        'A status change moves the task to the bottom of the new column.',
      inputSchema: z.object({
        taskId: id('Task'),
        title: z.string().max(200).optional(),
        description: z.string().max(5000).optional(),
        status: taskStatus.optional(),
        priority: taskPriority.optional(),
        dueDate: dueDate.nullable().optional(),
      }),
      annotations: WRITE,
    },
    ({ taskId, ...patch }) => run(() => updateTask(ctx, taskId, patch)),
  )

  server.registerTool(
    'move_task',
    {
      title: 'Move task',
      description:
        'Moves a task to a status column, optionally between two tasks already in that column. ' +
        'Without neighbours it goes to the bottom.',
      inputSchema: z.object({
        taskId: id('Task'),
        status: taskStatus,
        beforeId: id('Task').optional().describe('Task that ends up directly above'),
        afterId: id('Task').optional().describe('Task that ends up directly below'),
      }),
      annotations: WRITE,
    },
    (input) => run(() => moveTask(ctx, input)),
  )

  server.registerTool(
    'delete_task',
    {
      title: 'Delete task',
      description: 'Permanently deletes a task and detaches it from notes.',
      inputSchema: z.object({ taskId: id('Task') }),
      annotations: DESTRUCTIVE,
    },
    ({ taskId }) => run(() => deleteTask(ctx, taskId)),
  )

  // Notes

  server.registerTool(
    'list_notes',
    {
      title: 'List notes',
      description: 'Note summaries (no body). Filter by title substring and/or tag.',
      inputSchema: z.object({ search: z.string().optional(), tag: z.string().optional() }),
      annotations: READ,
    },
    (filter) => run(() => listNotes(ctx, filter)),
  )

  server.registerTool(
    'list_tags',
    { title: 'List tags', description: 'All note tags with usage counts.', annotations: READ },
    () => run(() => listTags(ctx)),
  )

  server.registerTool(
    'get_note',
    {
      title: 'Get note',
      description:
        'A note with its markdown body, resolved [[wiki links]] (noteId null when the target does not exist yet), ' +
        'backlinks, and linked projects and tasks.',
      inputSchema: z.object({ noteId: id('Note') }),
      annotations: READ,
    },
    ({ noteId }) =>
      run(async () => {
        const { html: _html, ...detail } = await getNote(ctx, noteId)
        return detail
      }),
  )

  server.registerTool(
    'create_note',
    {
      title: 'Create note',
      inputSchema: z.object({
        title: z.string().max(200).describe('Unique per user, case-insensitive'),
        body: z.string().max(100_000).optional().describe('Markdown; use [[Title]] to link notes'),
        tags: tags.optional(),
        projectIds: z.array(z.string()).optional(),
        taskIds: z.array(z.string()).optional(),
      }),
      annotations: WRITE,
    },
    (input) => run(() => createNote(ctx, input)),
  )

  server.registerTool(
    'update_note',
    {
      title: 'Update note',
      description:
        'Changes note fields. Omitted fields keep their current value; arrays replace the current list. ' +
        'To edit part of the body, read it with get_note first and send the full new body.',
      inputSchema: z.object({
        noteId: id('Note'),
        title: z.string().max(200).optional(),
        body: z.string().max(100_000).optional(),
        tags: tags.optional(),
        projectIds: z.array(z.string()).optional(),
        taskIds: z.array(z.string()).optional(),
      }),
      annotations: WRITE,
    },
    ({ noteId, ...patch }) => run(() => updateNote(ctx, noteId, patch)),
  )

  server.registerTool(
    'delete_note',
    {
      title: 'Delete note',
      description: 'Permanently deletes a note. Links to its title from other notes become unresolved.',
      inputSchema: z.object({ noteId: id('Note') }),
      annotations: DESTRUCTIVE,
    },
    ({ noteId }) => run(() => deleteNote(ctx, noteId)),
  )

  return server
}
