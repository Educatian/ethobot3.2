import React, { useState, useEffect } from 'react';
import { useEthobot } from './hooks/useEthobot';
import ActivationModal from './components/ActivationModal';
import ChatLayout from './components/ChatLayout';
import SessionRecoveryModal from './components/SessionRecoveryModal';
import ProjectOverviewPage from './components/ProjectOverviewPage';
import { Toaster, toast } from 'react-hot-toast';
import { clearLocalSession } from './services/loggingService';
import { useLanguage } from './contexts/LanguageContext';
import { isSupabaseConfigured, supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const { language, t } = useLanguage();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCheckingSession(false);
      return;
    }

    // Check active sessions and sets the listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  if (checkingSession) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-alabama-crimson border-dashed rounded-full animate-spin"></div>
      </div>
    );
  }

  if (typeof window !== 'undefined' && window.location.pathname === '/project-overview') {
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

export default App;
