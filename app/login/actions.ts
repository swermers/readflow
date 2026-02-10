'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

// --- 1. GOOGLE LOGIN ACTION ---
export async function signInWithGoogle() {
  const supabase = await createClient();
  
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

// --- 2. EMAIL MAGIC LINK ACTION ---
export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string).trim();
  
  const redirectUrl = 'https://readflow-inky.vercel.app/auth/callback';

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

// --- 3. VERIFY CODE ACTION ---
export async function verifyOtp(formData: FormData) {
  const email = (formData.get('email') as string)?.trim();
  const rawToken = (formData.get('token') as string) || '';
  
  // Remove ALL spaces from the token
  const token = rawToken.replace(/\s/g, ''); 

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    return redirect(`/login?email=${encodeURIComponent(email)}&message=Invalid code`);
  }

  return redirect('/');
}