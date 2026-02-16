import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/highlights/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('highlights')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH /api/highlights/[id] — update note text
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const body = await request.json();
  const { note } = body;

  const { data, error } = await supabase
    .from('highlights')
    .update({ note: note?.trim() || null })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
