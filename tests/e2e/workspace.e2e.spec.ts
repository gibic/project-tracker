import { test, expect, type Page } from '@playwright/test'

import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

test.describe.configure({ mode: 'serial' })

test.describe('Workspace', () => {
  let page: Page
  const projectName = `E2E Project ${Date.now()}`
  const noteTitle = `Spec notes ${Date.now()}`
  const linkedTitle = `Glossary ${Date.now()}`

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    page = await (await browser.newContext()).newPage()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('redirects to login and signs in', async () => {
    await page.goto(baseURL)
    await expect(page).toHaveURL(`${baseURL}/login`)
    await page.getByLabel('Email').fill(testUser.email)
    await page.getByLabel('Password').fill(testUser.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('creates a project and tasks', async () => {
    await page.goto(`${baseURL}/projects`)
    await page.getByRole('button', { name: 'New project' }).click()
    await page.getByLabel('Name').fill(projectName)
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible()

    for (const title of ['Write spec', 'Ship it']) {
      await page.getByLabel('Task title').fill(title)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.getByRole('region', { name: 'To do' }).getByText(title)).toBeVisible()
    }
  })

  test('drags a task to done and keeps it after reload', async () => {
    const card = page.getByRole('region', { name: 'To do' }).getByRole('button', { name: /Write spec/ })
    const saved = page.waitForResponse((response) => response.request().method() === 'POST')
    await card.dragTo(page.getByRole('region', { name: 'Done' }))
    // Optimistic: visible before the server action finishes.
    await expect(page.getByRole('region', { name: 'Done' }).getByText('Write spec')).toBeVisible()
    await saved
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('region', { name: 'Done' }).getByText('Write spec')).toBeVisible()
    await expect(page.getByText('1/2 done')).toBeVisible()
  })

  test('writes notes linked with [[wiki links]]', async () => {
    await page.goto(`${baseURL}/notes/new`)
    await page.getByLabel('Title').fill(noteTitle)
    await page.getByLabel('Content').fill(`## Plan\n\nTerms live in [[${linkedTitle}]].`)
    await page.getByLabel('Tags').fill('Planning')
    await page.getByLabel(projectName).check()
    await page.getByRole('button', { name: 'Create note' }).click()

    await expect(page.getByRole('heading', { name: noteTitle })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()
    await expect(page.getByRole('link', { name: '#planning' })).toBeVisible()

    // The link target does not exist yet: following it prefills a new note.
    await page.getByRole('article').getByRole('link', { name: linkedTitle }).click()
    await expect(page.getByLabel('Title')).toHaveValue(linkedTitle)
    await page.getByRole('button', { name: 'Create note' }).click()

    await expect(page.getByRole('heading', { name: linkedTitle })).toBeVisible()
    await expect(page.getByRole('link', { name: noteTitle })).toBeVisible() // backlink
  })
})
