import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

const sanitizeFileName = (name: string) => {
  const normalized = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized.slice(0, 120) || 'update';
};

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const title = String(formData.get('title') || '').trim();
    const content = String(formData.get('content') || '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const safeName = sanitizeFileName(file.name);
    const uploadPath = `live-updates/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Updates')
      .upload(uploadPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || 'Failed to upload image' }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage.from('Updates').getPublicUrl(uploadPath);
    const href = publicData?.publicUrl || '';

    const { error: insertError } = await supabaseAdmin.from('Updates').insert({ title, content, href });

    if (insertError) {
      await supabaseAdmin.storage.from('Updates').remove([uploadPath]);
      return NextResponse.json({ error: insertError.message || 'Failed to create update' }, { status: 500 });
    }

    return NextResponse.json({ success: true, href });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown server error' },
      { status: 500 }
    );
  }
}
