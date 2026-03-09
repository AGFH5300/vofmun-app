// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import HomePage from '@/app/home/page';
import LoginPage from '@/app/login/page';
import LiveUpdatesPage from '@/app/live-updates/page';
import SpeechRepoPage from '@/app/speechrepo/page';
import GlossaryPage from '@/app/glossary/page';
import ResolutionsPage from '@/app/resolutions/page';
import MessagesPage from '@/app/messages/page';
import AdminPage from '@/app/admin/page';
import ChairPage from '@/app/chair/page';
import ResetPasswordPage from '@/app/reset-password/page';
import { Navigate, useRouter } from './router';

const normalizePath = (path: string) => (path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path);

const App = () => {
  const { pathname } = useRouter();
  const normalizedPath = normalizePath(pathname);

  switch (normalizedPath) {
    case '/login':
      return <LoginPage />;
    case '/reset-password':
      return <ResetPasswordPage />;
    case '/home':
      return <HomePage />;
    case '/live-updates':
      return <LiveUpdatesPage />;
    case '/speechrepo':
      return <SpeechRepoPage />;
    case '/glossary':
      return <GlossaryPage />;
    case '/resolutions':
      return <ResolutionsPage />;
    case '/messages':
      return <MessagesPage />;
    case '/admin':
      return <AdminPage />;
    case '/chair':
      return <ChairPage />;
    case '/':
      return <Navigate to="/login" replace />;
    default:
      return null;
  }
};

export default App;
