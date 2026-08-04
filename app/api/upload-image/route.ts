import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TITLE_LENGTH = 180;
const MAX_CONTENT_LENGTH = 6000;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

    const sessionUser = await getVerifiedSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const title = String(formData.get('title') || '').trim();
    const content = String(formData.get('content') || '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image must be smaller than 8 MB' }, { status: 400 });
    }
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }
    if (title.length > MAX_TITLE_LENGTH || content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: 'Update title or content is too long' }, { status: 400 });
    }

    const safeName = sanitizeFileName(file.name);
    const uploadPath = `live-updates/${crypto.randomUUID()}-${safeName}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Updates')
      .upload(uploadPath, Buffer.from(bytes), {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('[upload-image] storage upload failed', {
        userId: sessionUser.id,
        message: uploadError.message,
      });
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage.from('Updates').getPublicUrl(uploadPath);
    const href = publicData?.publicUrl || '';
    if (!href) {
      await supabaseAdmin.storage.from('Updates').remove([uploadPath]);
      return NextResponse.json({ error: 'Failed to resolve image URL' }, { status: 500 });
    }

    const { error: insertError } = await supabaseAdmin.from('Updates').insert({ title, content, href });

    if (insertError) {
      await supabaseAdmin.storage.from('Updates').remove([uploadPath]);
      console.error('[upload-image] update insert failed', {
        userId: sessionUser.id,
        message: insertError.message,
      });
      return NextResponse.json({ error: 'Failed to create update' }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, href },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[upload-image] unexpected failure', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unable to publish update' }, { status: 500 });
  }
}
