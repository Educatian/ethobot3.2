import type { User, LogEvent, LogEventType, SessionLog } from '../types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

let sessionLog: SessionLog | null = null;
const SHEETS_API_URL = 'https://sheets-api-function-515497328571.europe-west1.run.app/';
const LOG_TASK_TIMEOUT_MS = 6000;
const MAX_BACKGROUND_LOG_TASKS = 48;
const SHOULD_LOG_DEBUG = import.meta.env.DEV && import.meta.env.VITE_DEBUG_LOGS === 'true';
const backgroundLogQueue: Array<() => Promise<void>> = [];
let isProcessingBackgroundLogQueue = false;

const debugLog = (method: 'log' | 'warn' | 'error', ...args: unknown[]) => {
  if (!SHOULD_LOG_DEBUG) {
    return;
  }
  console[method](...args);
};

/**
 * Emits a structured log to the console in JSON format.
 * This is useful for environments like Google Cloud Run that can parse structured logs.
 * In the browser build, it is disabled by default and only enabled via VITE_DEBUG_LOGS=true.
 */
const structuredLog = (severity: 'INFO' | 'WARNING' | 'ERROR', payload: object) => {
  if (!SHOULD_LOG_DEBUG) {
    return;
  }

  const redactedPayload = JSON.parse(
    JSON.stringify(payload, (key, value) => {
      if (
        key === 'userMessage' ||
        key === 'chatbotMessage' ||
        key === 'user_message' ||
        key === 'bot_response'
      ) {
        return '[redacted]';
      }
      return value;
    })
  );

  const logData = {
    severity,
    timestamp: new Date().toISOString(),
    ...redactedPayload,
  };

  console.log(JSON.stringify(logData));
};

const withLogTimeout = async (task: Promise<unknown>, label: string) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      task,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${label} timed out after ${LOG_TASK_TIMEOUT_MS}ms`)),
          LOG_TASK_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const processBackgroundLogQueue = async () => {
  if (isProcessingBackgroundLogQueue) {
    return;
  }

  isProcessingBackgroundLogQueue = true;

  while (backgroundLogQueue.length > 0) {
    const task = backgroundLogQueue.shift();
    if (!task) {
      continue;
    }

    try {
      await withLogTimeout(task(), 'Background log task');
    } catch (error) {
      debugLog('error', '[LOG QUEUE] Background task failed:', error);
    }
  }

  isProcessingBackgroundLogQueue = false;
};

const enqueueBackgroundLog = (task: () => Promise<void>) => {
  if (backgroundLogQueue.length >= MAX_BACKGROUND_LOG_TASKS) {
    backgroundLogQueue.shift();
    debugLog('warn', '[LOG QUEUE] Background queue is full. Dropping oldest log task.');
  }

  backgroundLogQueue.push(task);
  void processBackgroundLogQueue();
};

const buildLocalHistoryFromSessionLog = () => {
  const events = sessionLog?.events || [];

  const messages = events
    .filter(event => event.type === 'MESSAGE_EXCHANGE')
    .map((event, index) => ({
      id: `local-message-${index + 1}`,
      user_id: null,
      user_name: sessionLog?.studentInfo.name || 'Local User',
      course: sessionLog?.studentInfo.course || 'Local Course',
      user_message: event.details?.user || '',
      bot_response: event.details?.bot || '',
      timestamp: event.timestamp,
    }));

  const activity = events
    .filter(event => event.type !== 'MESSAGE_EXCHANGE')
    .map((event, index) => ({
      id: `local-activity-${index + 1}`,
      user_id: null,
      user_name: sessionLog?.studentInfo.name || 'Local User',
      course: sessionLog?.studentInfo.course || 'Local Course',
      event_type: event.type,
      details_json: event.details,
      timestamp: event.timestamp,
    }));

  return { messages, activity, isLocalOnly: true };
};

const getAuthenticatedSupabaseUser = async () => {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch (error) {
    debugLog('warn', '[SUPABASE] Unable to resolve authenticated user for logging.', error);
    return null;
  }
};

/**
 * Logs a user interaction (a message exchange between user and chatbot).
 */
export const logUserInteraction = async (
  userFullName: string,
  course: string,
  userMessage: string,
  chatbotMessage: string
) => {
  structuredLog('INFO', {
    eventType: 'MESSAGE_EXCHANGE',
    userFullName,
    course,
    userMessage,
    chatbotMessage,
  });

  try {
    const user = await getAuthenticatedSupabaseUser();
    if (!user) {
      return;
    }

    const { error } = await supabase.from('messages').insert([
      {
        user_id: user.id,
        user_name: userFullName,
        course,
        user_message: userMessage,
        bot_response: chatbotMessage,
        timestamp: new Date().toISOString(),
      },
    ]);

    if (error) {
      throw error;
    }

    debugLog('log', '[SUPABASE LOG] Successfully logged message exchange.');
  } catch (err) {
    debugLog('error', '[SUPABASE LOG] Failed to log message exchange:', err);
  }
};

/**
 * Logs a user click event to the console and sends it to a remote server.
 */
export const logClickEvent = async (
  userFullName: string,
  course: string,
  eventType: string,
  eventData: object,
  sessionId: number | null
) => {
  structuredLog('INFO', {
    eventType,
    userFullName,
    course,
    eventData,
  });

  const logData = {
    logType: eventType,
    userName: userFullName,
    userCourse: course,
    userMessage: null,
    botResponse: null,
    details_json: { ...eventData, sessionId },
  };

  try {
    const user = await getAuthenticatedSupabaseUser();

    await Promise.all([
      logToGoogleSheet(logData),
      (async () => {
        try {
          if (!user) {
            return;
          }

          const { error } = await supabase.from('activity_logs').insert([
            {
              user_id: user.id,
              user_name: userFullName,
              course,
              event_type: eventType,
              details_json: { ...eventData, sessionId },
              timestamp: new Date().toISOString(),
            },
          ]);

          if (error) {
            throw error;
          }

          debugLog('log', '[SUPABASE LOG] Successfully logged click event.');
        } catch (err) {
          debugLog('error', '[SUPABASE LOG] Failed to log click event to Supabase:', err);
        }
      })(),
    ]);
  } catch (err) {
    debugLog('error', '[LOG SERVICE] Error getting user for logging:', err);
    void logToGoogleSheet(logData);
  }
};

/**
 * Logs summary information about a user session.
 */
export const logSessionInfo = (userFullName: string, course: string, sessionDuration: number) => {
  structuredLog('INFO', {
    eventType: 'SESSION_INFO',
    userFullName,
    course,
    sessionDuration,
  });
};

/**
 * Sends a generic log object to the Google Sheets logging endpoint.
 */
export const logToGoogleSheet = async (logObj: object) => {
  try {
    await fetch(SHEETS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logObj),
    });
    debugLog('log', '[SERVER LOG] Successfully sent log to Google Sheet.');
  } catch (error) {
    debugLog('error', '[SERVER LOG] Failed to send log to Google Sheet:', error);
  }
};

export const queueUserInteractionLog = (
  userFullName: string,
  course: string,
  userMessage: string,
  chatbotMessage: string
) => {
  enqueueBackgroundLog(async () => {
    await logUserInteraction(userFullName, course, userMessage, chatbotMessage);
  });
};

export const queueClickEventLog = (
  userFullName: string,
  course: string,
  eventType: string,
  eventData: object,
  sessionId: number | null
) => {
  enqueueBackgroundLog(async () => {
    await logClickEvent(userFullName, course, eventType, eventData, sessionId);
  });
};

export const queueGoogleSheetLog = (logObj: object) => {
  enqueueBackgroundLog(async () => {
    await logToGoogleSheet(logObj);
  });
};

// --- Local Session Management for Data Download Feature ---

export const startSession = (user: User) => {
  sessionLog = {
    studentInfo: user,
    events: [],
  };
  addLog('SESSION_START' as LogEventType.SESSION_START, { user });
};

export const addLog = (type: LogEventType, details: any) => {
  if (!sessionLog) return;
  const event: LogEvent = {
    type,
    timestamp: new Date().toISOString(),
    details,
  };
  sessionLog.events.push(event);
};

export const getSessionData = (): SessionLog | null => {
  return sessionLog;
};

export const downloadSessionData = () => {
  if (!sessionLog) {
    alert('No session data to download.');
    return;
  }
  const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(sessionLog, null, 2))}`;
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  const fileName = `ethobot_session_${sessionLog.studentInfo.name.replace(/\s/g, '_')}_${new Date().toISOString()}.json`;
  downloadAnchorNode.setAttribute('download', fileName);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

export const clearLocalSession = () => {
  localStorage.removeItem('ethobot_user');
  sessionLog = null;
};

/**
 * Fetches all persistent history for the currently authenticated user from Supabase.
 */
export const fetchUserHistory = async () => {
  try {
    const user = await getAuthenticatedSupabaseUser();
    if (!user) {
      return buildLocalHistoryFromSessionLog();
    }

    const [messagesRes, activityRes] = await Promise.all([
      supabase.from('messages').select('*').eq('user_id', user.id).order('timestamp', { ascending: true }),
      supabase.from('activity_logs').select('*').eq('user_id', user.id).order('timestamp', { ascending: true }),
    ]);

    if (messagesRes.error) throw messagesRes.error;
    if (activityRes.error) throw activityRes.error;

    return {
      messages: messagesRes.data,
      activity: activityRes.data,
      isLocalOnly: false,
    };
  } catch (err) {
    debugLog('error', '[SUPABASE] Failed to fetch user history:', err);
    return buildLocalHistoryFromSessionLog();
  }
};
