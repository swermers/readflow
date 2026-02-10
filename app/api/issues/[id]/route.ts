import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/issues/[id] — Update issue status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const body = await request.json();
  const { status } = body;

  // Validate status
  const validStatuses = ['unread', 'read', 'archived'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Must be: unread, read, or archived' },
      { status: 400 }
    );
  }

  // Build the update object
  const updateData: any = { status };
  
  if (status === 'read') {
    updateData.read_at = new Date().toISOString();
  } else if (status === 'archived') {
    updateData.archived_at = new Date().toISOString();
    // Also mark as read if archiving
    if (!updateData.read_at) {
      updateData.read_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('issues')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}