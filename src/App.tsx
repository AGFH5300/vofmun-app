import HomePage from '@/app/home/page';
import LoginPage from '@/app/login/page';
import LiveUpdatesPage from '@/app/live-updates/page';
import SpeechRepoPage from '@/app/speechrepo/page';
import GlossaryPage from '@/app/glossary/page';
import ResolutionsPage from '@/app/resolutions/page';
import MessagesPage from '@/app/messages/page';
import AdminPage from '@/app/admin/page';
import ChairPage from '@/app/chair/page';
import { Navigate, useRouter } from './router';

const App = () => {
  const { pathname } = useRouter();

  switch (pathname) {
    case '/login':
      return <LoginPage />;
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
      return <Navigate to="/home" replace />;
    default:
      return <Navigate to="/home" replace />;
  }
};

export default App;
