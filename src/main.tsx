import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@/app/globals.css';
import { SessionProvider } from '@/app/context/sessionContext';
import AppWrapper from '@/components/AppWrapper';
import { Toaster } from 'sonner';
import { RouterProvider } from './router';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider>
      <SessionProvider>
        <AppWrapper>
          <App />
        </AppWrapper>
        <Toaster />
      </SessionProvider>
    </RouterProvider>
  </React.StrictMode>,
);
