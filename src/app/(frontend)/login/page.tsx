import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/features/auth/LoginForm'
import { getSessionUser, hasAnyUser } from '@/infrastructure/auth/session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/')
  const firstRun = !(await hasAnyUser())

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Workspace</CardTitle>
          <CardDescription>Notes and projects, in one place.</CardDescription>
        </CardHeader>
        <CardContent>
          {firstRun ? (
            <p className="text-sm">
              No account exists yet.{' '}
              <Link href="/admin/create-first-user" className="font-medium underline underline-offset-4">
                Create the first user
              </Link>
              , then come back here.
            </p>
          ) : (
            <LoginForm />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
