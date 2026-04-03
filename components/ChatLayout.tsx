import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical, LogOut, Menu, UserCircle, X as CloseIcon } from 'lucide-react';
import type { EthobotHook } from '../hooks/useEthobot';
import { useLanguage } from '../contexts/LanguageContext';
import ChatWindow from './ChatWindow';
import LearnerCoachingPanel from './LearnerCoachingPanel';
import PanelErrorBoundary from './PanelErrorBoundary';
import ProgressBar from './ProgressBar';
import { ArrowDownTrayIcon, InformationCircleIcon } from './icons';

const TeacherAnalyticsPanel = lazy(() => import('./TeacherAnalyticsPanel'));
const AboutEthobot = lazy(() => import('./AboutEthobot'));
const AccountModal = lazy(() => import('./AccountModal'));
const ReflectionMapPage = lazy(() => import('./ReflectionMapPage'));

interface ChatLayoutProps {
  ethobot: EthobotHook;
  onLogout: () => void;
}

const ChatLayout: React.FC<ChatLayoutProps> = ({ ethobot, onLogout }) => {
  const {
    user,
    currentStage,
    messages,
    sendMessage,
    isLoading,
    downloadData,
    logClickEvent,
    reasoningAnalytics,
  } = ethobot;
  const [isAboutVisible, setIsAboutVisible] = useState(false);
  const [isAccountVisible, setIsAccountVisible] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<'learner' | 'analytics' | 'reflection'>('learner');
  const [isLearnerRailCollapsed, setIsLearnerRailCollapsed] = useState(false);
  const [learnerRailWidth, setLearnerRailWidth] = useState(360);
  const [isResizingLearnerRail, setIsResizingLearnerRail] = useState(false);
  const [isStageHeaderCollapsed, setIsStageHeaderCollapsed] = useState(true);
  const { language, setLanguage, t } = useLanguage();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const learnerTurnCount = useMemo(
    () => reasoningAnalytics.analyses.filter(entry => entry.sender === 'user').length,
    [reasoningAnalytics.analyses]
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isResizingLearnerRail) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      const clampedWidth = Math.max(300, Math.min(520, nextWidth));
      setLearnerRailWidth(clampedWidth);
      if (isLearnerRailCollapsed) {
        setIsLearnerRailCollapsed(false);
      }
    };

    const handlePointerUp = () => {
      setIsResizingLearnerRail(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [isLearnerRailCollapsed, isResizingLearnerRail]);

  const navigateToView = (view: 'learner' | 'analytics' | 'reflection') => {
    setActiveView(view);
    setIsAccountMenuOpen(false);
  };

  const openProjectOverview = () => {
    setIsAccountMenuOpen(false);
    window.location.assign('/project-overview');
  };

  const currentViewLabel =
    activeView === 'learner'
      ? 'Learner Workspace'
      : activeView === 'analytics'
        ? 'Instructor Analytics'
        : 'Reflection Map';

  const currentSidebarTitle =
    activeView === 'learner'
      ? 'Stay with the dialogue'
      : activeView === 'analytics'
        ? 'Supervisory reading'
        : 'Reflection mapping';

  const currentSidebarBody =
    activeView === 'learner'
      ? 'Use the learner workspace for live dialogue, coaching prompts, and gradual ethical reflection.'
      : activeView === 'analytics'
        ? 'Use the instructor view to inspect patterns, overrides, and regulation traces without interrupting the learner flow.'
        : 'Turn the current dialogue into a visual concept map, refine it, and export it for discussion.';

  const expandedLearnerRailWidth = `${learnerRailWidth}px`;

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-lyceum-paper text-lyceum-ink">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#00181b]/45 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[22rem] flex-shrink-0 transform flex-col border-r border-white/10 bg-gradient-to-br from-lyceum-ink via-lyceum-ink to-lyceum-ink-soft px-5 py-6 text-[#f5efe2] transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-lyceum-paper">ETHOBOT</h1>
          </div>
          <button
            onClick={() => {
              logClickEvent('sidebar-close-button', 'button', 'Close Sidebar');
              setIsSidebarOpen(false);
            }}
            className="rounded-full p-2 text-[#f5efe2]/65 transition hover:bg-white/10 hover:text-white lg:hidden"
            title="Close sidebar"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-panel">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#f5efe2]/55">{t('studentInfo')}</p>
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#f5efe2]/40">{t('nameLabel')}</p>
              <p className="mt-1 text-sm font-semibold text-[#fbf6ea]">{user?.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#f5efe2]/40">{t('courseLabel')}</p>
              <p className="mt-1 text-sm font-semibold text-[#fbf6ea]">{user?.course}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-panel">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#f5efe2]/55">
                {activeView === 'learner'
                  ? 'Learner Workspace'
                  : activeView === 'analytics'
                    ? 'Instructor View'
                    : activeView === 'project'
                      ? 'Project Overview'
                      : 'Reflection Map'}
              </p>
              <h3 className="mt-3 font-headline text-2xl font-bold text-white">{currentSidebarTitle}</h3>
              <p className="mt-3 text-sm leading-7 text-[#f5efe2]/72">{currentSidebarBody}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    logClickEvent('sidebar-open-learner-workspace', 'button', 'Learner Workspace');
                    navigateToView('learner');
                    setIsSidebarOpen(false);
                  }}
                  className={`rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                    activeView === 'learner'
                      ? 'bg-white text-lyceum-ink'
                      : 'border border-white/10 bg-white/5 text-[#f5efe2]/80 hover:bg-white/10'
                  }`}
                >
                  Learner Workspace
                </button>
                <button
                  onClick={() => {
                    logClickEvent('sidebar-open-instructor-analytics', 'button', 'Instructor Analytics');
                    navigateToView('analytics');
                    setIsSidebarOpen(false);
                  }}
                  className={`rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                    activeView === 'analytics'
                      ? 'bg-white text-lyceum-ink'
                      : 'border border-white/10 bg-white/5 text-[#f5efe2]/80 hover:bg-white/10'
                  }`}
                >
                  Instructor Analytics
                </button>
                <button
                  onClick={() => {
                    logClickEvent('sidebar-open-project-overview', 'button', 'Project Overview');
                    openProjectOverview();
                    setIsSidebarOpen(false);
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5efe2]/80 transition hover:bg-white/10"
                >
                  Project Overview
                </button>
                <button
                  onClick={() => {
                    logClickEvent('sidebar-open-reflection-map', 'button', 'Reflection Map');
                    navigateToView('reflection');
                    setIsSidebarOpen(false);
                  }}
                  className={`rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                    activeView === 'reflection'
                      ? 'bg-white text-lyceum-ink'
                      : 'border border-white/10 bg-white/5 text-[#f5efe2]/80 hover:bg-white/10'
                  }`}
                >
                  Reflection Map
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-5 border-t border-white/10 pt-4">
          <button
            id="about-ethobot-button"
            onClick={(e) => {
              logClickEvent('about-ethobot-button', 'button', e.currentTarget.textContent);
              setIsAboutVisible(true);
              setIsSidebarOpen(false);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-[#f5efe2]/86 transition hover:bg-white/10 hover:text-white"
            title="View information about Ethobot"
          >
            <InformationCircleIcon className="h-4 w-4" />
            {t('aboutEthobot')}
          </button>
          <button
            id="download-data-button"
            onClick={(e) => {
              logClickEvent('download-data-button', 'button', e.currentTarget.textContent);
              downloadData();
              setIsSidebarOpen(false);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white/95 px-4 py-3 text-sm font-bold text-lyceum-ink transition hover:bg-white"
            title="Export your activity data as JSON"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {t('downloadData')}
          </button>
        </footer>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-transparent">
        <header className="relative z-40 border-b border-lyceum-line/70 bg-[#f5f2e8]/90 px-4 py-4 backdrop-blur sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  logClickEvent('sidebar-open-button', 'button', 'Open Sidebar');
                  setIsSidebarOpen(true);
                }}
                className="rounded-full border border-lyceum-line bg-white/80 p-2 text-lyceum-ink transition hover:bg-white lg:hidden"
                title="Open navigation menu"
              >
                <Menu size={18} />
              </button>
              <div className="hidden sm:block">
                <ProgressBar currentStage={currentStage} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-lyceum-line bg-white/70 p-1 sm:flex">
                <button
                  onClick={() => {
                    logClickEvent('language-switch-en', 'button', 'English');
                    setLanguage('en');
                  }}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] transition ${
                    language === 'en'
                      ? 'bg-lyceum-ink text-white'
                      : 'text-lyceum-muted hover:text-lyceum-ink'
                  }`}
                  title="Switch interface to English"
                >
                  EN
                </button>
                <button
                  onClick={() => {
                    logClickEvent('language-switch-ko', 'button', 'Korean');
                    setLanguage('ko');
                  }}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] transition ${
                    language === 'ko'
                      ? 'bg-lyceum-ink text-white'
                      : 'text-lyceum-muted hover:text-lyceum-ink'
                  }`}
                  title="Switch interface to Korean"
                >
                  KO
                </button>
              </div>
              <div className="hidden rounded-full border border-lyceum-line bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-lyceum-accent lg:block">
                {Math.round(reasoningAnalytics.latestCDOI * 100)} CDOI
              </div>
              <div className="relative" ref={accountMenuRef}>
                <button
                  id="account-button"
                  onClick={() => {
                    logClickEvent('account-button', 'button', 'Account Menu');
                    setIsAccountMenuOpen(open => !open);
                  }}
                  className="flex items-center gap-2 rounded-full border border-lyceum-line bg-white/85 px-3 py-2 text-lyceum-ink shadow-sm transition hover:bg-white"
                  title="Open workspace and account menu"
                >
                  <UserCircle size={18} className="text-lyceum-accent" />
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold leading-tight">{user?.name}</p>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-lyceum-muted">
                      {currentViewLabel}
                    </p>
                  </div>
                  <ChevronDown size={16} className={`text-lyceum-muted transition ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isAccountMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[70] w-64 rounded-[1.35rem] border border-lyceum-line bg-[#fffdf8] p-2 shadow-panel">
                    <button
                      onClick={() => {
                        logClickEvent('account-menu-learner-workspace', 'button', 'Learner Workspace');
                        navigateToView('learner');
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                        activeView === 'learner' ? 'bg-lyceum-paper-deep text-lyceum-ink' : 'text-lyceum-ink-soft hover:bg-lyceum-paper-soft'
                      }`}
                    >
                      <span className="font-semibold">Learner Workspace</span>
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lyceum-muted">Live</span>
                    </button>
                    <button
                      onClick={() => {
                        logClickEvent('account-menu-instructor-analytics', 'button', 'Instructor Analytics');
                        navigateToView('analytics');
                      }}
                      className={`mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                        activeView === 'analytics' ? 'bg-lyceum-paper-deep text-lyceum-ink' : 'text-lyceum-ink-soft hover:bg-lyceum-paper-soft'
                      }`}
                    >
                      <span className="font-semibold">Instructor Analytics</span>
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lyceum-muted">Review</span>
                    </button>
                    <button
                      onClick={() => {
                        logClickEvent('account-menu-account-details', 'button', 'Account Details');
                        setIsAccountVisible(true);
                        setIsAccountMenuOpen(false);
                      }}
                      className="mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-lyceum-ink-soft transition hover:bg-lyceum-paper-soft"
                    >
                      <span className="font-semibold">Account Details</span>
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lyceum-muted">Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        logClickEvent('account-menu-project-overview', 'button', 'Project Overview');
                        openProjectOverview();
                      }}
                      className="mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-lyceum-ink-soft transition hover:bg-lyceum-paper-soft"
                    >
                      <span className="font-semibold">Project Overview</span>
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lyceum-muted">Research</span>
                    </button>
                    <button
                      onClick={() => {
                        logClickEvent('account-menu-reflection-map', 'button', 'Reflection Map');
                        navigateToView('reflection');
                      }}
                      className={`mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                        activeView === 'reflection'
                          ? 'bg-lyceum-paper-deep text-lyceum-ink'
                          : 'text-lyceum-ink-soft hover:bg-lyceum-paper-soft'
                      }`}
                    >
                      <span className="font-semibold">Reflection Map</span>
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lyceum-muted">Visualize</span>
                    </button>
                    <button
                      onClick={() => {
                        logClickEvent('account-menu-logout', 'button', 'Log Out');
                        setIsAccountMenuOpen(false);
                        onLogout();
                      }}
                      className="mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                    >
                      <span className="font-semibold">Sign Out</span>
                      <LogOut size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {activeView === 'learner' ? (
          <>
            <section className="min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full min-h-0 items-stretch">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <section className="flex-shrink-0 border-b border-lyceum-line/60 bg-transparent px-4 py-3 sm:px-8 sm:py-4 lg:px-12">
                    <div className="mx-auto max-w-5xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.32em] text-lyceum-muted">Socratic Dialogue Stage</p>
                          <h2 className="mt-1 font-headline text-2xl font-extrabold uppercase leading-none tracking-tight text-lyceum-ink sm:text-[2rem]">
                            Problem Statement
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsStageHeaderCollapsed(collapsed => !collapsed)}
                          className="flex flex-shrink-0 items-center gap-2 rounded-full border border-lyceum-line bg-white/85 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-lyceum-muted transition hover:bg-white hover:text-lyceum-ink"
                          title={isStageHeaderCollapsed ? 'Expand stage overview' : 'Collapse stage overview'}
                        >
                          {isStageHeaderCollapsed ? 'Expand' : 'Fold'}
                          <ChevronDown size={14} className={`transition ${isStageHeaderCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.26em] text-lyceum-muted">Learning Stage</p>
                        <div className="rounded-full border border-lyceum-accent/20 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-lyceum-accent">
                          {currentStage}
                        </div>
                      </div>

                      {!isStageHeaderCollapsed && (
                        <>
                          <div className="mt-2 h-1 w-16 rounded-full bg-lyceum-accent" />
                          <p className="mt-2 max-w-3xl text-xs leading-5 text-lyceum-muted">
                            Trace the dilemma carefully, compare ethical frameworks, and let the system surface deeper questions before you settle on a conclusion.
                          </p>
                        </>
                      )}
                    </div>
                  </section>

                  <ChatWindow
                    messages={messages}
                    isLoading={isLoading}
                    onSendMessage={sendMessage}
                    onLogClick={logClickEvent}
                  />
                </div>

                <div
                  className={`relative hidden h-full flex-shrink-0 border-l border-lyceum-line/70 bg-[#f5f2e8] xl:block ${
                    isResizingLearnerRail ? '' : 'transition-[width] duration-300 ease-in-out'
                  }`}
                  style={{ width: isLearnerRailCollapsed ? '1.5rem' : expandedLearnerRailWidth }}
                >
                  <button
                    type="button"
                    onClick={() => setIsLearnerRailCollapsed(collapsed => !collapsed)}
                    className="absolute left-0 top-8 z-20 flex h-16 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-lyceum-line bg-white/95 text-lyceum-muted shadow-panel transition hover:bg-white"
                    title={isLearnerRailCollapsed ? 'Open coaching rail' : 'Collapse coaching rail'}
                  >
                    {isLearnerRailCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    onMouseDown={() => setIsResizingLearnerRail(true)}
                    className={`absolute left-0 top-0 h-full w-3 -translate-x-1/2 cursor-col-resize ${isLearnerRailCollapsed ? 'pointer-events-none opacity-0' : ''}`}
                    title="Drag to resize coaching rail"
                  >
                    <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-lyceum-line bg-white/95 p-1 text-lyceum-muted shadow-sm">
                      <GripVertical size={12} />
                    </div>
                  </div>

                  {!isLearnerRailCollapsed && (
                    <PanelErrorBoundary
                      fallbackTitle="Learner Coaching Unavailable"
                      fallbackBody="The coaching rail is temporarily unavailable, but you can continue the dialogue normally."
                    >
                      <LearnerCoachingPanel analytics={reasoningAnalytics} variant="sidebar" />
                    </PanelErrorBoundary>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : activeView === 'analytics' ? (
          <section className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-7xl">
              <div className="border-b border-lyceum-line/60 pb-8">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.34em] text-lyceum-muted">Supervisory Surface</p>
                <h2 className="mt-3 font-headline text-4xl font-extrabold tracking-tight text-lyceum-ink sm:text-5xl">
                  Instructor Analytics
                </h2>
                <div className="mt-5 h-1 w-24 rounded-full bg-lyceum-accent" />
                <p className="mt-5 max-w-3xl text-sm leading-7 text-lyceum-muted">
                  Monitor adaptive questioning, review flagged turns, and inspect how the learner's reasoning path changes over time without exposing the full dashboard inside the learner workspace.
                </p>
              </div>

              <div className="mt-8">
                <div className="mb-6 rounded-[1.5rem] border border-lyceum-line bg-[#f8f3e8] p-5 shadow-panel">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">Session Pulse</p>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="font-headline text-4xl font-bold text-lyceum-ink">{learnerTurnCount}</p>
                      <p className="text-xs text-lyceum-muted">learner turns mapped</p>
                    </div>
                    <div className="rounded-full border border-lyceum-line bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-lyceum-accent">
                      {reasoningAnalytics.provider}
                    </div>
                  </div>
                </div>

                <PanelErrorBoundary
                  fallbackTitle="Instructor Analytics Unavailable"
                  fallbackBody="The teaching dashboard hit a rendering issue, but the learner workspace can keep running safely."
                >
                  <Suspense
                    fallback={
                      <div className="rounded-[1.5rem] border border-lyceum-line bg-white p-6 shadow-panel">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">Instructor Analytics</p>
                        <p className="mt-3 text-sm text-lyceum-muted">Loading the supervisory dashboard...</p>
                      </div>
                    }
                  >
                    <TeacherAnalyticsPanel
                      analytics={reasoningAnalytics}
                      messages={messages}
                      user={user}
                      onLogClick={logClickEvent}
                      reasoningAnnotations={ethobot.reasoningAnnotations}
                      localReviewedCalibrationProfile={ethobot.localReviewedCalibrationProfile}
                      importedReviewedCalibrationProfile={ethobot.importedReviewedCalibrationProfile}
                      reviewedCalibrationProfile={ethobot.reviewedCalibrationProfile}
                      queuedInstructorOverride={ethobot.queuedInstructorOverride}
                      onQueueInstructorOverride={ethobot.queueInstructorOverride}
                      onClearInstructorOverride={ethobot.clearInstructorOverride}
                      onSaveReasoningAnnotation={ethobot.saveReasoningAnnotation}
                      onClearReasoningAnnotation={ethobot.clearReasoningAnnotation}
                      onImportReviewedCalibrationProfile={ethobot.importReviewedCalibrationProfile}
                      onClearImportedReviewedCalibrationProfile={ethobot.clearImportedReviewedCalibrationProfile}
                    />
                  </Suspense>
                </PanelErrorBoundary>
              </div>
            </div>
          </section>
        ) : (
          <Suspense
            fallback={
              <section className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-5xl rounded-[1.5rem] border border-lyceum-line bg-white p-6 shadow-panel">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">Reflection Map</p>
                  <p className="mt-3 text-sm text-lyceum-muted">Loading the visual reflection space...</p>
                </div>
              </section>
            }
          >
            <ReflectionMapPage
              messages={messages}
              reasoningAnalytics={reasoningAnalytics}
              onBack={() => navigateToView('learner')}
              onLogClick={logClickEvent}
            />
          </Suspense>
        )}
      </main>

      <Suspense fallback={null}>
        {isAboutVisible && (
          <AboutEthobot
            isOpen={isAboutVisible}
            onClose={() => setIsAboutVisible(false)}
            onOpenProjectOverview={openProjectOverview}
            onLogClick={logClickEvent}
          />
        )}
      </Suspense>
      <Suspense fallback={null}>
        {isAccountVisible && (
          <AccountModal
            isOpen={isAccountVisible}
            user={user}
            onClose={() => setIsAccountVisible(false)}
            onLogout={onLogout}
            onResumeSession={ethobot.resumeSession}
            onLogClick={logClickEvent}
          />
        )}
      </Suspense>
    </div>
  );
};

export default ChatLayout;
