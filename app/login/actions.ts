'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

// Function 1: Send the Magic Link (Used by the old server-side flow)
export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  
  // Hardcoded for Vercel production
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

// Function 2: Verify the Code (The new function you added)
export async function verifyOtp(formData: FormData) {
  const email = formData.get('email') as string;
  const token = formData.get('token') as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    return redirect(`/login?email=${email}&message=Invalid code`);
  }

  return redirect('/');
}