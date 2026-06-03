import React, { useEffect, useState } from 'react';
import { useEthobot } from './hooks/useEthobot';
import ActivationModal from './components/ActivationModal';
import ChatLayout from './components/ChatLayout';
import ProjectOverviewPage from './components/ProjectOverviewPage';
import Cat100Page from './components/Cat100Page';
import { Toaster, toast } from 'react-hot-toast';
import { clearLocalSession } from './services/loggingService';
import { useLanguage } from './contexts/LanguageContext';
import { isSupabaseConfigured, supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';

const getPathname = () =>
  typeof window === 'undefined' ? '/' : window.location.pathname;

// Legacy facial-recognition shell — the one that depends on `useEthobot` and
// the legacy Gemini-direct chat. Kept isolated so it does not run on /cat100,
// which has its own chat client and would otherwise show a spurious
// "AI assistant could not be initialized" toast in production.
const LegacyEthobotApp: React.FC<{ session: Session | null; pathname: string }> = ({
  session,
  pathname,
}) => {
  const { language, t } = useLanguage();
  const ethobot = useEthobot(language);

  const handleActivate = (name: string, course: string) => {
    ethobot.activateUser(name, course, session?.user.email || '');
    toast.success(t('sessionActivated'));
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    clearLocalSession();
    window.location.reload();
  };

  const isAccessGranted = Boolean(session) || ethobot.isUserActivated;

  if (pathname === '/project-overview') {
    return (
      <div className="font-sans bg-gray-50 text-gray-800">
        <ProjectOverviewPage
          onBack={() => {
            window.location.assign('/');
          }}
          onLogClick={ethobot.logClickEvent}
        />
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <div className="font-sans bg-gray-50 text-gray-800">
      {!isAccessGranted ? (
        <ActivationModal onActivate={handleActivate} onLogClick={ethobot.logClickEvent} />
      ) : (
        <ChatLayout ethobot={ethobot} onLogout={handleLogout} />
      )}
      <Toaster position="top-center" />
    </div>
  );
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [pathname, setPathname] = useState<string>(getPathname);

  useEffect(() => {
    setPathname(getPathname());
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checkingSession) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-alabama-crimson border-dashed rounded-full animate-spin"></div>
      </div>
    );
  }

  // Study entry for all sections/courses: passcode → name dropdown → persona.
  // The passcode determines the section/course; study cells are assigned live
  // (assign_cell RPC, global counterbalancing) and hidden from students.
  // Renders WITHOUT useEthobot so the legacy Gemini-direct chat never runs here.
  if (
    pathname === '/course' || pathname === '/enter' || pathname === '/cat100' ||
    pathname === '/cat531' || pathname === '/snu' || pathname === '/study'
  ) {
    return (
      <div className="font-sans">
        <Cat100Page
          mode="roster"
          defaultCourse={pathname === '/snu' ? 'SNU' : undefined}
          onBack={() => {
            window.location.assign('/');
          }}
        />
        <Toaster position="top-center" />
      </div>
    );
  }

  return <LegacyEthobotApp session={session} pathname={pathname} />;
};

export default App;
