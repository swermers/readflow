'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  
  // ⚠️ HARDCODED URL: We are manually typing your Vercel URL here.
  // When you work on localhost, you will need to change this back to localhost.
  const redirectUrl = 'https://readflow-inky.vercel.app/auth/callback';

  console.log('Sending magic link to:', redirectUrl);

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