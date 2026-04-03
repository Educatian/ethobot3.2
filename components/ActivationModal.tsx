import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import NetworkBackground from './NetworkBackground';

interface ActivationModalProps {
  onActivate: (name: string, course: string) => void;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
}

const ActivationModal: React.FC<ActivationModalProps> = ({ onActivate, onLogClick }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [testingCode, setTestingCode] = useState('');
  const [isTestingPromptOpen, setIsTestingPromptOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const startLocalSession = (override?: { name?: string; course?: string }) => {
    const localName = override?.name || name.trim() || email.split('@')[0] || 'Test Learner';
    const localCourse = override?.course || course.trim() || 'ETHICS-TEST';
    onActivate(localName, localCourse);
    toast.success('Local session started.');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        startLocalSession();
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onActivate(name || email.split('@')[0], course || 'General');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, course },
          },
        });
        if (error) throw error;
        toast.success('Registration successful. Please check your email.');
        onActivate(name, course);
      }
    } catch (error: any) {
      toast.error(error.message || t('errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const heroBullets =
    language === 'ko'
      ? ['실제 AI 윤리 사례 탐구', '소크라테스식 추론 코칭', '교수자·학습자 분석 피드백']
      : ['Explore real AI ethics cases', 'Socratic reasoning coaching', 'Teacher and learner analytics'];

  const testingPromptCopy =
    language === 'ko'
      ? {
          title: '테스트 코드 입력',
          body: '테스트 워크스페이스에 들어가려면 코드를 입력하세요.',
          placeholder: '코드를 입력하세요',
          submit: '입장하기',
          cancel: '취소',
          error: '테스트 코드가 올바르지 않습니다.',
        }
      : {
          title: 'Enter testing code',
          body: 'Enter the code to open the testing workspace.',
          placeholder: 'Enter code',
          submit: 'Enter workspace',
          cancel: 'Cancel',
          error: 'Incorrect testing code.',
        };

  const handleTestingCodeSubmit = () => {
    if (testingCode.trim().toLowerCase() !== 'immersivebama') {
      toast.error(testingPromptCopy.error);
      return;
    }

    setIsTestingPromptOpen(false);
    setTestingCode('');
    startLocalSession({ name: 'Test Learner', course: 'immersivebama' });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyceum-paper px-3 py-4 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <NetworkBackground />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(#904d00 0.7px, transparent 0.7px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute left-[6%] top-[12%] text-xs font-black uppercase tracking-[0.32em] text-lyceum-accent/20 sm:text-sm">
          Transparency
        </div>
        <div className="absolute right-[8%] top-[22%] text-sm font-black uppercase tracking-[0.3em] text-lyceum-accent/15 sm:text-xl">
          Fairness
        </div>
        <div className="absolute bottom-[16%] left-[14%] text-xs font-black uppercase tracking-[0.28em] text-lyceum-accent/15 sm:text-lg">
          Accountability
        </div>
        <div className="absolute bottom-[24%] right-[10%] text-xs font-black uppercase tracking-[0.28em] text-lyceum-accent/10 sm:text-base">
          Human Agency
        </div>
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-lyceum-line/80 bg-white/92 shadow-[0_28px_80px_rgba(28,28,22,0.12)] backdrop-blur sm:rounded-[2.25rem] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden min-h-[720px] overflow-hidden bg-gradient-to-br from-lyceum-ink to-[#0d3b3f] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_44%)]" />
            <div className="relative z-10">
              <h1 className="mt-6 max-w-md font-headline text-6xl font-bold leading-[0.96] tracking-tight">
                ETHOBOT
              </h1>
              <div className="mt-5 h-1 w-24 rounded-full bg-lyceum-accent" />
              <p className="mt-8 max-w-md text-lg leading-8 text-white/82">
                {t('aboutSubtitle')}
              </p>
              <div className="mt-12 max-w-md">
                <p className="font-headline text-3xl font-semibold leading-tight text-white">
                  Think slower. See wider. Judge better.
                </p>
                <p className="mt-4 text-sm leading-7 text-white/72">
                  A calm space for ethical dilemmas, perspective shifts, and reflective reasoning.
                </p>
              </div>
            </div>

            <div className="relative z-10">
              <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/8 p-6 backdrop-blur">
                {heroBullets.map(item => (
                  <div key={item} className="flex items-center gap-3 text-sm text-white/82">
                    <span className="h-2.5 w-2.5 rounded-full bg-lyceum-accent" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    onLogClick('landing-lang-en', 'button', 'English');
                    setLanguage('en');
                  }}
                  className={`border-b pb-1 text-sm transition ${
                    language === 'en' ? 'border-white text-white' : 'border-transparent text-white/55 hover:text-white'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLogClick('landing-lang-ko', 'button', '한국어');
                    setLanguage('ko');
                  }}
                  className={`border-b pb-1 text-sm transition ${
                    language === 'ko' ? 'border-white text-white' : 'border-transparent text-white/55 hover:text-white'
                  }`}
                >
                  한국어
                </button>
              </div>
            </div>
          </section>

          <section className="relative flex min-h-[680px] flex-col justify-center bg-[#fffdf8] px-5 py-8 sm:px-8 sm:py-10 lg:min-h-[720px] lg:px-12">
            <div className="mx-auto w-full max-w-xl">
              <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
                <div>
                  <p className="font-headline text-sm uppercase tracking-[0.32em] text-lyceum-muted">ETHOBOT</p>
                  <p className="mt-2 font-headline text-3xl font-bold text-lyceum-ink">{t('aboutSubtitle')}</p>
                </div>
                <div className="rounded-2xl bg-white p-2 shadow-lg ring-1 ring-lyceum-line">
                  <img
                    src="/ethobot_mark.svg"
                    alt="Ethobot Logo"
                    className="h-16 w-16 rounded-xl object-contain"
                  />
                </div>
              </div>

              <div className="mb-8">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">
                  {isSupabaseConfigured ? 'Workspace Access' : 'Quick Start'}
                </p>
                <h2 className="mt-3 font-headline text-4xl font-bold leading-tight text-lyceum-ink">
                  {!isSupabaseConfigured ? 'Enter ETHOBOT' : isLogin ? t('loginHeader') : t('signupHeader')}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-7 text-lyceum-ink-soft">
                  {!isSupabaseConfigured
                    ? 'Start with a lightweight session to explore the dialogue flow, coaching, and analytics.'
                    : isLogin
                      ? 'Use your account to continue a saved ETHOBOT learning session.'
                      : 'Create an account to save learner history, analytics, and classroom progress.'}
                </p>
              </div>

              {isSupabaseConfigured && (
                <div className="mb-6 flex items-center gap-3 text-sm text-lyceum-ink-soft">
                  <span>{isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onLogClick('auth-mode-toggle', 'button', isLogin ? 'Go to Register' : 'Go to Login');
                      setIsLogin(!isLogin);
                    }}
                    className="font-semibold text-lyceum-accent underline-offset-4 hover:underline"
                  >
                    {isLogin ? t('signUp') : t('signIn')}
                  </button>
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-5" id="auth-form">
                {(!isLogin || !isSupabaseConfigured) && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.24em] text-lyceum-muted">
                        {t('fullNameLabel')}
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={event => setName(event.target.value)}
                        className="w-full rounded-[1.1rem] border border-lyceum-line bg-white px-4 py-3 text-sm text-lyceum-ink shadow-inner outline-none transition focus:border-lyceum-accent focus:ring-2 focus:ring-lyceum-accent/15"
                        placeholder={t('fullNamePlaceholder')}
                        required={!isLogin || !isSupabaseConfigured}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.24em] text-lyceum-muted">
                        {t('courseNumberLabel')}
                      </span>
                      <input
                        type="text"
                        value={course}
                        onChange={event => setCourse(event.target.value)}
                        className="w-full rounded-[1.1rem] border border-lyceum-line bg-white px-4 py-3 text-sm text-lyceum-ink shadow-inner outline-none transition focus:border-lyceum-accent focus:ring-2 focus:ring-lyceum-accent/15"
                        placeholder={t('courseNumberPlaceholder')}
                        required={!isLogin || !isSupabaseConfigured}
                      />
                    </label>
                  </div>
                )}

                {isSupabaseConfigured && (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.24em] text-lyceum-muted">
                        {t('emailLabel')}
                      </span>
                      <input
                        type="email"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        className="w-full rounded-[1.1rem] border border-lyceum-line bg-white px-4 py-3 text-sm text-lyceum-ink shadow-inner outline-none transition focus:border-lyceum-accent focus:ring-2 focus:ring-lyceum-accent/15"
                        placeholder="email@example.com"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.24em] text-lyceum-muted">
                        {t('passwordLabel')}
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        className="w-full rounded-[1.1rem] border border-lyceum-line bg-white px-4 py-3 text-sm text-lyceum-ink shadow-inner outline-none transition focus:border-lyceum-accent focus:ring-2 focus:ring-lyceum-accent/15"
                        placeholder="••••••••"
                        required
                      />
                    </label>
                  </>
                )}

                <div className="space-y-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    onClick={() => onLogClick('auth-submit-button', 'button', isLogin ? 'Sign In' : 'Sign Up')}
                    className="w-full rounded-full bg-lyceum-ink px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#0d3b3f] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading
                      ? isLogin
                        ? 'Signing In...'
                        : 'Signing Up...'
                      : !isSupabaseConfigured
                        ? 'Enter Local Workspace'
                        : isLogin
                          ? t('signInButton')
                          : t('signUpButton')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onLogClick('skip-for-testing', 'button', 'Skip for testing');
                      setTestingCode('');
                      setIsTestingPromptOpen(true);
                    }}
                    className="w-full rounded-full border border-lyceum-line bg-[#f5efe3] px-5 py-3 text-sm font-semibold text-lyceum-ink transition hover:bg-[#eee5d4]"
                  >
                    Skip for testing
                  </button>
                </div>
              </form>

              <div className="mt-8 border-t border-lyceum-line/80 pt-5">
                <div className="flex justify-end gap-4 lg:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      onLogClick('landing-lang-en-mobile', 'button', 'English');
                      setLanguage('en');
                    }}
                    className={`text-xs ${language === 'en' ? 'font-bold text-lyceum-accent' : 'text-lyceum-muted'}`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLogClick('landing-lang-ko-mobile', 'button', '한국어');
                      setLanguage('ko');
                    }}
                    className={`text-xs ${language === 'ko' ? 'font-bold text-lyceum-accent' : 'text-lyceum-muted'}`}
                  >
                    한국어
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {isTestingPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#00181b]/58 p-4 backdrop-blur-sm"
          onClick={() => {
            onLogClick('testing-code-close-overlay', 'div', 'Close Testing Code Prompt');
            setIsTestingPromptOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-[1.75rem] border border-lyceum-line bg-[#fffdf8] p-6 shadow-panel"
            onClick={event => event.stopPropagation()}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">Testing Access</p>
            <h3 className="mt-3 font-headline text-3xl font-bold text-lyceum-ink">{testingPromptCopy.title}</h3>
            <p className="mt-3 text-sm leading-7 text-lyceum-ink-soft">{testingPromptCopy.body}</p>

            <label className="mt-6 block">
              <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.24em] text-lyceum-muted">
                Access Code
              </span>
              <input
                autoFocus
                type="password"
                value={testingCode}
                onChange={event => setTestingCode(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleTestingCodeSubmit();
                  }
                }}
                className="w-full rounded-[1.1rem] border border-lyceum-line bg-white px-4 py-3 text-sm text-lyceum-ink shadow-inner outline-none transition focus:border-lyceum-accent focus:ring-2 focus:ring-lyceum-accent/15"
                placeholder={testingPromptCopy.placeholder}
              />
            </label>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onLogClick('testing-code-cancel', 'button', testingPromptCopy.cancel);
                  setIsTestingPromptOpen(false);
                }}
                className="flex-1 rounded-full border border-lyceum-line bg-[#f5efe3] px-4 py-3 text-sm font-semibold text-lyceum-ink transition hover:bg-[#eee5d4]"
              >
                {testingPromptCopy.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onLogClick('testing-code-submit', 'button', testingPromptCopy.submit);
                  handleTestingCodeSubmit();
                }}
                className="flex-1 rounded-full bg-lyceum-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0d3b3f]"
              >
                {testingPromptCopy.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivationModal;
