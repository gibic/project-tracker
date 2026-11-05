import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { validateAuthorizationRequest, type AuthorizationRequest } from '@/application/oauth/useCases'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isOAuthError } from '@/domain/oauth/oauth'
import { authorizeAction } from '@/features/oauth/actions'
import { authorizePath, pickAuthorizeParams } from '@/features/oauth/params'
import { getPayloadClient, getSessionUser } from '@/infrastructure/auth/session'
import { createOAuthContext } from '@/infrastructure/container'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Connect an app' }

const destination = (redirectUri: string) => {
  const url = new URL(redirectUri)
  return url.host || url.protocol.replace(/:$/, '')
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const params = pickAuthorizeParams((key) => query[key])

  const user = await getSessionUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(authorizePath(params))}`)

  let request: AuthorizationRequest | null = null
  let problem: string | null = null
  try {
    request = await validateAuthorizationRequest(createOAuthContext(await getPayloadClient()), params)
  } catch (error) {
    if (!isOAuthError(error)) throw error
    problem = error.message
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        {request ? (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Connect {request.client.name}</CardTitle>
              <CardDescription>
                {request.client.name} wants to use your workspace as {user.email}.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>Read your projects, tasks and notes</li>
                <li>Create, change and delete them</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                You will be sent back to <span className="font-medium text-foreground">{destination(request.redirectUri)}</span>.
                Only allow apps you trust. You can revoke access in Admin › OAuth Grants.
              </p>
              <form action={authorizeAction} className="flex gap-2">
                {Object.entries(params).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
                <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
                  Deny
                </Button>
                <Button type="submit" name="decision" value="allow" className="flex-1">
                  Allow
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <CardHeader>
            <CardTitle className="text-xl">Can’t connect this app</CardTitle>
            <CardDescription role="alert">{problem}</CardDescription>
          </CardHeader>
        )}
      </Card>
    </div>
  )
}
