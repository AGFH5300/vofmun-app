// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import { AdminRoute } from '@/components/protectedroute';
import { getBrowserAccessToken } from '@/lib/auth/browserAuthFetch';
import { toast } from 'sonner';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const Page = () => {
  const [content, setContent] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const previewUrl = React.useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  );

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(event.target.value);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      toast.error('Please choose a JPEG, PNG, or WebP image.');
      event.target.value = '';
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('The image must be smaller than 8 MB.');
      event.target.value = '';
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleAddUpdate = async () => {
    if (isPublishing) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!content.trim()) {
      toast.error('Content is required');
      return;
    }
    if (!selectedFile) {
      toast.error('Image file is required');
      return;
    }

    setIsPublishing(true);
    try {
      const accessToken = await getBrowserAccessToken('admin-live-update');
      if (!accessToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title.trim());
      formData.append('content', content.trim());

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create update');
      }

      setTitle('');
      setContent('');
      setSelectedFile(null);
      toast.success('Update added successfully!');
      const fileInput = document.querySelector('#image-upload') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error adding update:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to publish the update');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <AdminRoute>
      <div className="page-shell">
        <div className="page-maxwidth max-w-4xl space-y-10">
          <header className="surface-card is-emphasised px-8 py-10 text-center">
            <span className="badge-pill mx-auto mb-4 inline-flex justify-center bg-white/15 text-white/80">Admin Controls</span>
            <h1 className="font-serif text-3xl font-semibold text-white md:text-4xl">Publish Live Update</h1>
            <p className="mx-auto mt-3 max-w-2xl text-white/80">
              Share crisis updates with delegates. Upload an image, craft the headline, and publish instantly to the live feed.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
            <div className="surface-card flex flex-col gap-4 p-6">
              <h2 className="text-lg font-semibold text-deep-red">Upload Image</h2>
              <label htmlFor="image-upload" className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-soft-ivory bg-warm-light-grey/80 p-6 transition-all hover:border-deep-red/60">
                <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-10 w-10 text-deep-red" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
                <span className="text-center text-sm text-almost-black-green/70">Choose a JPEG, PNG, or WebP image up to 8 MB</span>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isPublishing}
                />
                {selectedFile && previewUrl ? (
                  <div className="mt-4 w-full text-center">
                    <img
                      src={previewUrl}
                      alt="Selected update preview"
                      className="mx-auto h-28 w-28 rounded-xl border border-soft-ivory object-cover shadow"
                      width={112}
                      height={112}
                    />
                    <p className="mt-2 break-all text-xs text-almost-black-green/60">{selectedFile.name}</p>
                  </div>
                ) : null}
              </label>
            </div>

            <div className="surface-card flex flex-col gap-4 p-6">
              <div>
                <label htmlFor="update-title" className="mb-2 block text-xs uppercase tracking-[0.3em] text-deep-red/70">Title</label>
                <textarea
                  id="update-title"
                  className="w-full resize-none rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-almost-black-green focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/20"
                  value={title}
                  placeholder="Write your update title here..."
                  onChange={handleTitleChange}
                  rows={2}
                  maxLength={180}
                  disabled={isPublishing}
                />
              </div>

              <div>
                <label htmlFor="update-content" className="mb-2 block text-xs uppercase tracking-[0.3em] text-deep-red/70">Content</label>
                <textarea
                  id="update-content"
                  className="h-48 w-full resize-none rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-almost-black-green focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/20"
                  value={content}
                  placeholder="Write your update content here..."
                  onChange={handleContentChange}
                  maxLength={6000}
                  disabled={isPublishing}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddUpdate}
                  className="primary-button disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPublishing}
                >
                  {isPublishing ? 'Publishing…' : 'Add Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminRoute>
  );
};

export default Page;
