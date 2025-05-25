'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const userInput = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword(userInput)

    if (error) {
      redirect('/error')
      // return error;
    }

    // Revalidate all paths to ensure auth state is updated everywhere
    revalidatePath('/', 'layout')
    revalidatePath('/login', 'layout')
    redirect('/')
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An unexpected error occurred during login') 
  }
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/error')
  }

  // Revalidate all paths to ensure auth state is updated everywhere
  revalidatePath('/', 'layout')
  revalidatePath('/login', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    redirect('/error')
  }
  
  // Revalidate all paths to ensure auth state is updated everywhere
  revalidatePath('/', 'layout')
  revalidatePath('/login', 'layout')
  redirect('/login')
}

