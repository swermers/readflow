'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  
  // We hardcode this for now to guarantee it works on localhost
  // Later we can change it to use the production domain
  const redirectUrl = 'http://localhost:3000/auth/callback';

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    console.error('Auth Error:', error); // Log error to console so you can see it
    return redirect('/login?message=Could not authenticate user');
  }

  return redirect('/login?message=Check your email for the magic link!');
}