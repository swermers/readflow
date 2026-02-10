'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  
// ... existing imports and login function ...

export async function verifyOtp(formData: FormData) {
  'use server'; // Ensure this runs on the server
  
  const email = formData.get('email') as string;
  const token = formData.get('token') as string;
  const supabase = await createClient();

  // Verify the 6-digit code (token)
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    return redirect(`/login?email=${email}&message=Invalid code`);
  }

  // If successful, go to Dashboard
  return redirect('/');
}