'use server'

import { redirect } from 'next/navigation'

import { signIn, signOut } from '@/infrastructure/auth/session'

export interface LoginState {
  error?: string
  email?: string
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password.', email }

  try {
    await signIn(email, password)
  } catch {
    return { error: 'Email or password is incorrect.', email }
  }
  redirect('/')
}

export async function logoutAction(): Promise<void> {
  await signOut()
  redirect('/login')
}
