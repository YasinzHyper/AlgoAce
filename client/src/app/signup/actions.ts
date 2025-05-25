'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validate input
  if (!email || !password) {
    throw new Error('Email and password are required')
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (error) {
      throw error
    }

    if (data?.user) {
      // Revalidate all paths to ensure auth state is updated everywhere
      revalidatePath('/', 'layout')
      revalidatePath('/login', 'layout')
      revalidatePath('/signup', 'layout')
      
      // Redirect to login page with success message
      redirect('/login?message=Check your email to confirm your account')
    }
  } catch (error) {
    console.error('Signup error:', error)
    throw error
  }
} 