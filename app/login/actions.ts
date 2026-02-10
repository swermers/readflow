'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers'; // <--- Make sure to add this import at the top!

export async function signInWithGoogle() {
  const supabase = await createClient();
export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string).trim(); // Clean extra spaces
  
  // Hardcoded for Vercel production
  const redirectUrl = 'https://readflow-inky.vercel.app/auth/callback';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    console.error(error);
    return redirect('/auth/auth-code-error?error=Could not connect to Google');
  }

  if (data.url) {
    return redirect(data.url);
  }
}

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    console.error('Auth Error:', error);
    return redirect('/login?message=Could not authenticate user');
  }

  return redirect('/login?message=Check your email for the magic link!');
}

export async function verifyOtp(formData: FormData) {
  // 1. Clean the inputs
  const email = (formData.get('email') as string)?.trim();
  const rawToken = (formData.get('token') as string) || '';
  
  // Remove ALL spaces from the token (handles "123 456" or " 123456 ")
  const token = rawToken.replace(/\s/g, ''); 

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    // Send them back to the login page with the email pre-filled and the error
    return redirect(`/login?email=${encodeURIComponent(email)}&message=Invalid code`);
  }

  return redirect('/');
}