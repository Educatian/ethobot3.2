
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import type {
  User,
  Message,
  ProblemStage,
  LogEventType,
  ReasoningAnalyticsSnapshot,
  PedagogicalMove,
  HumanReasoningAnnotation,
  ReviewedCalibrationCorpusEntry,
  ReviewedCalibrationProfile,
  ReasoningState,
  DiscourseStrategy,
} from '../types';
import { STAGES, getInitialBotMessage } from '../constants';
import * as loggingService from '../services/loggingService';
import { toast } from 'react-hot-toast';
// FIX: Import geminiService to resolve "Cannot find name 'geminiService'" errors.
import * as geminiService from '../services/geminiService';
import {
  analyzeLearnerTurn,
  createEmptyReasoningAnalyticsSnapshot,
  applyInstructorOverride,
  buildReviewedCalibrationProfile,
  isReviewedCalibrationProfile,
  mapReasoningStateToProblemStage,
  mergeReviewedCalibrationProfiles,
  rebuildReasoningAnalytics,
} from '../services/reasoningAnalyticsService';

const getReviewedCorpusStorageKey = (language: string) => `ethobot_reviewed_corpus_${language}`;
const getImportedReviewedProfileStorageKey = (language: string) => `ethobot_imported_reviewed_profile_${language}`;

export const useEthobot = (language: string) => {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStage, setCurrentStage] = useState<ProblemStage>(STAGES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatReady, setIsChatReady] = useState(false);
  const [reasoningAnalytics, setReasoningAnalytics] = useState<ReasoningAnalyticsSnapshot>(createEmptyReasoningAnalyticsSnapshot());
  const [queuedInstructorOverride, setQueuedInstructorOverride] = useState<PedagogicalMove | null>(null);
  const [reasoningAnnotations, setReasoningAnnotations] = useState<Record<string, HumanReasoningAnnotation>>({});
  const [reviewedCalibrationCorpus, setReviewedCalibrationCorpus] = useState<Record<string, ReviewedCalibrationCorpusEntry>>({});
  const [importedReviewedCalibrationProfile, setImportedReviewedCalibrationProfile] = useState<ReviewedCalibrationProfile | null>(null);
  const localReviewedCalibrationProfile = useMemo<ReviewedCalibrationProfile | null>(
    () => buildReviewedCalibrationProfile(Object.values(reviewedCalibrationCorpus)),
    [reviewedCalibrationCorpus]
  );
  const reviewedCalibrationProfile = useMemo<ReviewedCalibrationProfile | null>(
    () => mergeReviewedCalibrationProfiles(localReviewedCalibrationProfile, importedReviewedCalibrationProfile),
    [localReviewedCalibrationProfile, importedReviewedCalibrationProfile]
  );

  // Refs for robust logging
  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const sessionStartTimeRef = useRef<number | null>(null);
  const reasoningAnalyticsRef = useRef<ReasoningAnalyticsSnapshot>(createEmptyReasoningAnalyticsSnapshot());
  reasoningAnalyticsRef.current = reasoningAnalytics;
  const reviewedCorpusLoadedRef = useRef(false);

  // Gemini Initialization effect
  useEffect(() => {
    reviewedCorpusLoadedRef.current = false;
    setIsChatReady(false);
    toast.loading('Initializing AI assistant...', { id: 'init-toast' });
    geminiService.initializeChat(language).then(success => {
      setIsChatReady(success);
      if (success) {
        toast.success('AI assistant is ready!', { id: 'init-toast' });
      } else {
        toast.error("AI assistant could not be initialized.", { id: 'init-toast' });
      }
    });
    // When language changes, reset the chat with the new welcome message
    setMessages([getInitialBotMessage(language)]);
    setCurrentStage(STAGES[0]);
    setReasoningAnalytics(createEmptyReasoningAnalyticsSnapshot());
    setQueuedInstructorOverride(null);
    setReasoningAnnotations({});
    try {
      const storedCorpus = localStorage.getItem(getReviewedCorpusStorageKey(language));
      setReviewedCalibrationCorpus(storedCorpus ? JSON.parse(storedCorpus) : {});
    } catch (error) {
      console.warn('Unable to restore reviewed calibration corpus.', error);
      setReviewedCalibrationCorpus({});
    }
    try {
      const storedProfile = localStorage.getItem(getImportedReviewedProfileStorageKey(language));
      if (!storedProfile) {
        setImportedReviewedCalibrationProfile(null);
      } else {
        const parsedProfile = JSON.parse(storedProfile);
        setImportedReviewedCalibrationProfile(isReviewedCalibrationProfile(parsedProfile) ? (parsedProfile.profile || parsedProfile) : null);
      }
    } catch (error) {
      console.warn('Unable to restore imported reviewed profile.', error);
      setImportedReviewedCalibrationProfile(null);
    }
    reviewedCorpusLoadedRef.current = true;
  }, [language]); // Re-initialize when language changes

  useEffect(() => {
    if (!reviewedCorpusLoadedRef.current) {
      return;
    }
    try {
      localStorage.setItem(
        getReviewedCorpusStorageKey(language),
        JSON.stringify(reviewedCalibrationCorpus)
      );
    } catch (error) {
      console.warn('Unable to persist reviewed calibration corpus.', error);
    }
  }, [language, reviewedCalibrationCorpus]);

  useEffect(() => {
    if (!reviewedCorpusLoadedRef.current) {
      return;
    }
    try {
      if (importedReviewedCalibrationProfile) {
        localStorage.setItem(
          getImportedReviewedProfileStorageKey(language),
          JSON.stringify(importedReviewedCalibrationProfile)
        );
      } else {
        localStorage.removeItem(getImportedReviewedProfileStorageKey(language));
      }
    } catch (error) {
      console.warn('Unable to persist imported reviewed profile.', error);
    }
  }, [language, importedReviewedCalibrationProfile]);

  useEffect(() => {
    const learnerMessages = messages.filter(message => message.sender === 'user');
    if (!isChatReady || learnerMessages.length === 0) {
      return;
    }

    let cancelled = false;
    rebuildReasoningAnalytics(messages, reasoningAnnotations, reviewedCalibrationProfile)
      .then(rebuiltAnalytics => {
        if (!cancelled) {
          setReasoningAnalytics(rebuiltAnalytics);
          setCurrentStage(mapReasoningStateToProblemStage(rebuiltAnalytics.currentLearnerState));
        }
      })
      .catch(error => {
        console.warn('Unable to rebuild analytics after reviewed profile change.', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isChatReady, messages, reasoningAnnotations, reviewedCalibrationProfile]);

  // Load user and set up session logger
  useEffect(() => {
    if (!isSupabaseConfigured) {
      try {
        const storedUser = localStorage.getItem('ethobot_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          setUser(parsedUser);
          loggingService.startSession(parsedUser);
          sessionStartTimeRef.current = Date.now();
        }
      } catch (error) {
        console.warn('Unable to restore local user session.', error);
      }
      return;
    }

    const syncUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        const metadata = session.user.user_metadata;
        const newUser = {
          name: metadata.full_name || session.user.email?.split('@')[0] || 'Unknown',
          course: metadata.course || 'General',
          email: session.user.email
        };
        setUser(newUser);
        loggingService.startSession(newUser);
        sessionStartTimeRef.current = Date.now();
      }
    };

    syncUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        const metadata = session.user.user_metadata;
        const newUser = {
          name: metadata.full_name || session.user.email?.split('@')[0] || 'User',
          course: metadata.course || 'General',
          email: session.user.email
        };
        setUser(newUser);
        loggingService.startSession(newUser);
        sessionStartTimeRef.current = Date.now();
      } else {
        setUser(null);
      }
    });

    // Session end logger
    const handleBeforeUnload = () => {
      const currentUser = userRef.current;
      if (currentUser && sessionStartTimeRef.current) {
        const sessionDuration = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
        loggingService.logSessionInfo(currentUser.name, currentUser.course, sessionDuration);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      subscription.unsubscribe();
      handleBeforeUnload();
    };
  }, []); // This runs only once

  const isUserActivated = useMemo(() => !!user, [user]);

  const logClickEvent = useCallback((elementId: string, elementTag: string, textContent: string | null, additionalDetails: object = {}) => {
    const eventDetails = {
      elementId,
      elementTag,
      textContent: textContent?.trim(),
      ...additionalDetails,
    };
    loggingService.addLog('ELEMENT_CLICK' as LogEventType.ELEMENT_CLICK, eventDetails);

    loggingService.logClickEvent(
      user?.name || "Guest",
      user?.course || "N/A",
      'ELEMENT_CLICK',
      eventDetails,
      sessionStartTimeRef.current
    );
  }, [user]);

  const activateUser = (name: string, course: string, email: string) => {
    const newUser = { name, course, email };
    setUser(newUser);
    localStorage.setItem('ethobot_user', JSON.stringify(newUser));
    loggingService.startSession(newUser);
    sessionStartTimeRef.current = Date.now();
  };

  const resumeSession = async (historicalMessages: Message[], stage?: ProblemStage) => {
    setMessages(historicalMessages);
    setIsChatReady(true);
    const rebuiltAnalytics = await rebuildReasoningAnalytics(
      historicalMessages,
      reasoningAnnotations,
      reviewedCalibrationProfile
    );
    setReasoningAnalytics(rebuiltAnalytics);
    setQueuedInstructorOverride(null);
    setReasoningAnnotations({});
    setCurrentStage(stage || mapReasoningStateToProblemStage(rebuiltAnalytics.currentLearnerState));
    toast.success("Session resumed!");
  };

  const queueInstructorOverride = useCallback((move: PedagogicalMove) => {
    setQueuedInstructorOverride(move);
    toast.success(`Instructor override queued for the next adaptive turn: ${move}`);
  }, []);

  const clearInstructorOverride = useCallback(() => {
    setQueuedInstructorOverride(null);
  }, []);

  const importReviewedCalibrationProfile = useCallback((payload: unknown) => {
    if (!isReviewedCalibrationProfile(payload)) {
      toast.error('The selected file is not a valid reviewed profile artifact.');
      return false;
    }

    const normalizedProfile = ((payload as { profile?: ReviewedCalibrationProfile }).profile ||
      payload) as ReviewedCalibrationProfile;
    setImportedReviewedCalibrationProfile(normalizedProfile);
    toast.success(`Reviewed profile imported: ${normalizedProfile.providerLabel}`);
    return true;
  }, []);

  const clearImportedReviewedCalibrationProfile = useCallback(() => {
    setImportedReviewedCalibrationProfile(null);
    toast.success('Imported reviewed profile cleared.');
  }, []);

  const saveReasoningAnnotation = useCallback((
    messageId: string,
    annotation: {
      annotatedState: ReasoningState | null;
      annotatedStrategy: DiscourseStrategy | null;
      annotatedMove: PedagogicalMove | null;
      reviewDecision: HumanReasoningAnnotation['reviewDecision'];
      reviewerNotes: string;
    }
  ) => {
    const reviewedAt = new Date().toISOString();
    setReasoningAnnotations(prev => ({
      ...prev,
      [messageId]: {
        messageId,
        ...annotation,
        reviewedAt,
      },
    }));
    const sourceMessage = messages.find(message => message.id === messageId && message.sender === 'user');
    if (sourceMessage) {
      setReviewedCalibrationCorpus(prev => ({
        ...prev,
        [messageId]: {
          messageId,
          text: sourceMessage.text,
          annotatedState: annotation.annotatedState,
          annotatedStrategy: annotation.annotatedStrategy,
          annotatedMove: annotation.annotatedMove,
          reviewDecision: annotation.reviewDecision,
          reviewedAt,
        },
      }));
    }
    toast.success('Reasoning review saved.');
  }, [messages]);

  const clearReasoningAnnotation = useCallback((messageId: string) => {
    setReasoningAnnotations(prev => {
      if (!prev[messageId]) {
        return prev;
      }

      const nextAnnotations = { ...prev };
      delete nextAnnotations[messageId];
      return nextAnnotations;
    });
    setReviewedCalibrationCorpus(prev => {
      if (!prev[messageId]) {
        return prev;
      }

      const nextCorpus = { ...prev };
      delete nextCorpus[messageId];
      return nextCorpus;
    });
    toast.success('Reasoning review cleared.');
  }, []);

  const sendMessage = useCallback(async (text: string, fromChoiceButton: boolean = false) => {
    if (isLoading || !isChatReady) {
      if (!isChatReady) {
        toast.error("The AI assistant is not ready. Please try again shortly.");
      }
      return;
    }

    if (fromChoiceButton) {
      loggingService.addLog('CHOICE_SELECTED' as LogEventType.CHOICE_SELECTED, { choiceText: text });
      if (user) {
        loggingService.queueClickEventLog(user.name, user.course, 'CHOICE_SELECTED', { choiceText: text }, sessionStartTimeRef.current);
      }
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    if (fromChoiceButton) {
      await logClickEvent('choice-button', 'button', text);
    }

    const botMessageId = `bot-${Date.now()}`;
    const botMessagePlaceholder: Message = {
      id: botMessageId,
      sender: 'bot',
      text: '...',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, botMessagePlaceholder]);

    try {
      const nextAnalytics = await analyzeLearnerTurn(
        userMessage,
        reasoningAnalyticsRef.current,
        messages,
        reasoningAnnotations,
        reviewedCalibrationProfile
      );
      const effectiveAnalytics = queuedInstructorOverride
        ? applyInstructorOverride(nextAnalytics, queuedInstructorOverride)
        : nextAnalytics;
      setReasoningAnalytics(effectiveAnalytics);
      setCurrentStage(mapReasoningStateToProblemStage(effectiveAnalytics.currentLearnerState));
      if (queuedInstructorOverride) {
        setQueuedInstructorOverride(null);
      }

      const stream = geminiService.streamChat(text, messages.slice(1), effectiveAnalytics.currentMovePlan || undefined);

      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => prev.map(m => m.id === botMessageId ? { ...m, text: fullResponse + '...' } : m));
      }

      const finalBotMessage: Message = {
        id: botMessageId,
        sender: 'bot',
        text: fullResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => prev.map(m => m.id === botMessageId ? finalBotMessage : m));

      loggingService.addLog('MESSAGE_EXCHANGE' as LogEventType.MESSAGE_EXCHANGE, {
        user: userMessage.text,
        bot: finalBotMessage.text,
        stage: mapReasoningStateToProblemStage(effectiveAnalytics.currentLearnerState),
        reasoningAnalytics: {
          state: effectiveAnalytics.currentLearnerState,
          strategy: effectiveAnalytics.currentLearnerStrategy,
          discourseFunction: effectiveAnalytics.analyses[effectiveAnalytics.analyses.length - 1]?.discourseFunction,
          regulatoryStatus: effectiveAnalytics.regulatoryStatus,
          transitionEntropy: effectiveAnalytics.transitionEntropy,
          averageCoherence: effectiveAnalytics.averageCoherence,
          cdoi: effectiveAnalytics.latestCDOI,
          selectedMoves: effectiveAnalytics.currentMovePlan
            ? [
                effectiveAnalytics.currentMovePlan.primaryMove,
                ...(effectiveAnalytics.currentMovePlan.secondaryMove ? [effectiveAnalytics.currentMovePlan.secondaryMove] : []),
              ]
            : [],
          instructorOverrideApplied: queuedInstructorOverride,
        }
      });

      if (user) {
        loggingService.queueUserInteractionLog(user.name, user.course, userMessage.text, finalBotMessage.text);

        const logObj = {
          logType: 'MESSAGE_EXCHANGE',
          userName: user.name,
          userCourse: user.course,
          userMessage: userMessage.text,
          botResponse: finalBotMessage.text,
          details_json: {
            sessionId: sessionStartTimeRef.current,
            reasoningState: effectiveAnalytics.currentLearnerState,
            discourseStrategy: effectiveAnalytics.currentLearnerStrategy,
            discourseFunction: effectiveAnalytics.analyses[effectiveAnalytics.analyses.length - 1]?.discourseFunction,
            regulatoryStatus: effectiveAnalytics.regulatoryStatus,
            transitionEntropy: effectiveAnalytics.transitionEntropy,
            coherence: effectiveAnalytics.averageCoherence,
            cdoi: effectiveAnalytics.latestCDOI,
            selectedMoves: effectiveAnalytics.currentMovePlan
              ? [
                  effectiveAnalytics.currentMovePlan.primaryMove,
                  ...(effectiveAnalytics.currentMovePlan.secondaryMove ? [effectiveAnalytics.currentMovePlan.secondaryMove] : []),
                ]
              : [],
            instructorOverrideApplied: queuedInstructorOverride,
          }
        };
        loggingService.queueGoogleSheetLog(logObj);
      }

    } catch (error) {
      console.error('Gemini API error:', error);
      const errorMessage: Message = {
        id: botMessageId,
        sender: 'bot',
        text: 'Sorry, I encountered an error communicating with the AI. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => prev.map(m => m.id === botMessageId ? errorMessage : m));
      toast.error('An error occurred while communicating with the AI.');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, isChatReady, user, logClickEvent, queuedInstructorOverride, reasoningAnnotations, reviewedCalibrationProfile]);

  const downloadData = loggingService.downloadSessionData;

  return {
    user,
    isUserActivated,
    activateUser,
    messages,
    sendMessage,
    currentStage,
    isLoading,
    downloadData,
    logClickEvent,
    resumeSession,
    reasoningAnalytics,
    reasoningAnnotations,
    localReviewedCalibrationProfile,
    importedReviewedCalibrationProfile,
    reviewedCalibrationProfile,
    queuedInstructorOverride,
    queueInstructorOverride,
    clearInstructorOverride,
    saveReasoningAnnotation,
    clearReasoningAnnotation,
    importReviewedCalibrationProfile,
    clearImportedReviewedCalibrationProfile,
  };
};

export type EthobotHook = ReturnType<typeof useEthobot>;
