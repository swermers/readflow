'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  
  // This creates the magic link
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // This tells Supabase where to send you after you click the link in your email
      // We use the origin (e.g., localhost:3000) dynamically
      emailRedirectTo: `${headers().get('origin')}/auth/callback`,
    },
  });

  if (error) {
    return redirect('/login?message=Could not authenticate user');
  }

  return redirect('/login?message=Check your email for the magic link!');
}