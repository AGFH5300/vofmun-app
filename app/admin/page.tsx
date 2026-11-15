import React from 'react'
import {AdminRoute} from '@/components/protectedroute'
import {toast} from 'sonner'

const Page = () => {
    const [content, setContent] = React.useState<string>("");
    const [title, setTitle] = React.useState<string>("");
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
    }
    const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTitle(e.target.value);
    }
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    }

    const handleAddUpdate = async () => {
        if (!title.trim()) {
            toast.error("Title is required");
            return;
        }
        
        if (!content.trim()) {
            toast.error("Content is required");
            return;
        }
        
        if (!selectedFile) {
            toast.error("Image file is required");
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('title', title);
            formData.append('content', content);
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData,
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to create update');
            }
            
            setTitle("");
            setContent("");
            setSelectedFile(null);
            toast.success("Update added successfully!");
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) fileInput.value = "";
            
        } catch (error) {
            console.error('Error adding update:', error);
            toast.error("An unknown error occurred");
        }
    }

  return (
    <AdminRoute>
      <div className="page-shell">
        <div className="page-maxwidth max-w-4xl space-y-10">
          <header className="surface-card is-emphasised text-center px-8 py-10">
            <span className="badge-pill bg-white/15 text-white/80 inline-flex justify-center mx-auto mb-4">Admin Controls</span>
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-white">Publish Live Update</h1>
            <p className="text-white/80 max-w-2xl mx-auto mt-3">
              Share crisis updates with delegates. Upload an image, craft the headline, and publish instantly to the live feed.
            </p>
          </header>

          <div className="grid md:grid-cols-[1fr_1.2fr] gap-6">
            <div className="surface-card p-6 flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-deep-red">Upload Image</h2>
              <label htmlFor="image-upload" className="flex flex-col items-center justify-center border-2 border-dashed border-soft-ivory rounded-2xl bg-warm-light-grey/80 p-6 cursor-pointer transition-all hover:border-deep-red/60">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-deep-red mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
                <span className="text-sm text-almost-black-green/70 text-center">Click or drag an image here to upload (JPG)</span>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/jpeg, image/jpg"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <div className="mt-4 w-full text-center">
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Preview"
                      className="mx-auto w-28 h-28 object-cover rounded-xl border border-soft-ivory shadow"
                      width={112}
                      height={112}
                    />
                    <p className="text-xs text-almost-black-green/60 mt-2 break-all">{selectedFile.name}</p>
                  </div>
                )}
              </label>
            </div>

            <div className="surface-card p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-deep-red/70 block mb-2">Title</label>
                <textarea
                  className='w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-almost-black-green focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/20 resize-none'
                  value={title}
                  placeholder='Write your update title here...'
                  onChange={handleTitleChange}
                  rows={2}
                ></textarea>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-deep-red/70 block mb-2">Content</label>
                <textarea
                  className='w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-almost-black-green focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/20 resize-none h-48'
                  value={content}
                  placeholder='Write your update content here...'
                  onChange={handleContentChange}
                ></textarea>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleAddUpdate}
                  className='primary-button'
                >
                  Add Update
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}

export default Page