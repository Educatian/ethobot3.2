import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StudyCondition,
  type PositionInput,
  type PrePostDelta,
  type Scenario,
} from '../types';
import PreFormPosition from './personas/PreFormPosition';
import PostFormPosition from './personas/PostFormPosition';
import PersonaPanelCard from './personas/PersonaPanelCard';
import Cat100ChatView from './personas/Cat100ChatView';
import Cat100GatePage, { type Cat100Identity } from './Cat100GatePage';
import { summarizeDelta } from '../services/stancePrePost';
import { useLanguage } from '../contexts/LanguageContext';
import {
  logCat100Event,
  type Cat100LogContext,
} from '../services/cat100Logging';

const SESSION_KEY = 'cat100_session';

interface Cat100PageProps {
  onBack: () => void;
}

type Phase = 'intro' | 'pre' | 'chat' | 'post' | 'debrief';

const parseCondition = (raw: string | null): StudyCondition | null => {
  if (raw === 'ld' || raw === 'learner_directed') return StudyCondition.LEARNER_DIRECTED;
  if (raw === 'ar' || raw === 'ai_recommended') return StudyCondition.AI_RECOMMENDED;
  return null;
};

const parseScenarioId = (raw: string | null): string | null => {
  if (raw === 'a' || raw === 'scenario_a' || raw === 'scenario_a_classroom_monitoring') {
    return 'scenario_a_classroom_monitoring';
  }
  if (raw === 'b' || raw === 'scenario_b' || raw === 'scenario_b_edtech_data_sharing') {
    return 'scenario_b_edtech_data_sharing';
  }
  return null;
};

interface ResolvedIdentity {
  participantId: string;
  course: string;
  condition: StudyCondition | null;
  scenarioId: string | null;
  source: 'url' | 'code' | 'localStorage' | 'anonymous';
}

const readSessionIdentity = (): Cat100Identity | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage?.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cat100Identity;
    if (!parsed.pid) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistSessionIdentity = (identity: Cat100Identity) => {
  try {
    window.sessionStorage?.setItem(SESSION_KEY, JSON.stringify(identity));
  } catch {
    /* ignore */
  }
};

const clearSessionIdentity = () => {
  try {
    window.sessionStorage?.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
};

const fromIdentity = (identity: Cat100Identity): ResolvedIdentity => ({
  participantId: identity.pid,
  course: identity.course,
  condition:
    identity.condition === 'ld' ? StudyCondition.LEARNER_DIRECTED : StudyCondition.AI_RECOMMENDED,
  scenarioId: identity.scenario === 'a' ? 'scenario_a_classroom_monitoring' : 'scenario_b_edtech_data_sharing',
  source: identity.source,
});

const fromUrlParams = (): ResolvedIdentity | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const pid = params.get('pid')?.trim();
  const courseParam = params.get('course')?.trim();
  const condition = parseCondition(params.get('condition'));
  const scenarioId = parseScenarioId(params.get('scenario'));

  if (pid) {
    return {
      participantId: pid,
      course: courseParam || 'CAT 100',
      condition,
      scenarioId,
      source: 'url',
    };
  }

  // Researcher / test convenience: URL specifies condition or scenario but no
  // pid → generate anonymous pid and skip the gate. Real student URLs always
  // come through the gate (which assigns pid from the access code).
  if (condition || scenarioId) {
    return {
      participantId: `cat100-${Math.random().toString(36).slice(2, 8)}`,
      course: courseParam || 'CAT 100',
      condition,
      scenarioId,
      source: 'anonymous',
    };
  }

  return null;
};

const Cat100Page: React.FC<Cat100PageProps> = ({ onBack }) => {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [initialPosition, setInitialPosition] = useState<PositionInput | null>(null);
  const [closingPosition, setClosingPosition] = useState<PositionInput | null>(null);
  const [delta, setDelta] = useState<PrePostDelta | null>(null);
  const [closingReflection, setClosingReflection] = useState('');
  const { language } = useLanguage();

  const sessionStartTimeRef = useRef<number>(Date.now());

  // Identity resolution: sessionStorage (after gate) > URL params > null (show gate)
  const [identity, setIdentity] = useState<ResolvedIdentity | null>(() => {
    const sessionIdentity = readSessionIdentity();
    if (sessionIdentity) return fromIdentity(sessionIdentity);
    return fromUrlParams();
  });

  const fixedPersonaTurns = useMemo(() => {
    if (typeof window === 'undefined') return undefined as number | undefined;
    const params = new URLSearchParams(window.location.search);
    const turnsRaw = params.get('personaTurns');
    const turns = turnsRaw !== null ? parseInt(turnsRaw, 10) : NaN;
    return Number.isFinite(turns) && turns >= 1 && turns <= 5 ? turns : undefined;
  }, []);

  const condition = identity?.condition ?? null;
  const scenarioIdParam = identity?.scenarioId ?? null;

  const handleGateAccept = (resolved: Cat100Identity) => {
    persistSessionIdentity(resolved);
    setIdentity(fromIdentity(resolved));
  };

  const logContext: Cat100LogContext | null = useMemo(() => {
    if (!identity) return null;
    return {
      userFullName: identity.participantId,
      course: identity.course,
      sessionId: sessionStartTimeRef.current,
    };
  }, [identity]);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/scenarios.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Scenario[]) => {
        if (!cancelled) setScenarios(data);
      })
      .catch(err => {
        if (!cancelled) setLoadError(err?.message || 'Unable to load scenarios.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeScenario = useMemo(() => {
    if (!scenarios) return null;
    if (scenarioIdParam) {
      return scenarios.find(s => s.id === scenarioIdParam) ?? scenarios[0] ?? null;
    }
    return scenarios[0] ?? null;
  }, [scenarios, scenarioIdParam]);

  const conditionLabel =
    condition === StudyCondition.LEARNER_DIRECTED
      ? 'Learner-directed'
      : condition === StudyCondition.AI_RECOMMENDED
      ? 'AI-recommended'
      : 'unspecified';

  const handlePreFormSubmit = (position: PositionInput) => {
    setInitialPosition(position);
    if (activeScenario && logContext) {
      logCat100Event('CAT100_INITIAL_POSITION', logContext, {
        scenarioId: activeScenario.id,
        condition: condition ?? StudyCondition.LEARNER_DIRECTED,
        initialPosition: position,
      });
    }
    setPhase('chat');
  };

  const handlePostFormSubmit = (position: PositionInput, computedDelta: PrePostDelta, reflection: string) => {
    setClosingPosition(position);
    setDelta(computedDelta);
    setClosingReflection(reflection);
    if (activeScenario && initialPosition && logContext) {
      logCat100Event('CAT100_CLOSING_POSITION', logContext, {
        scenarioId: activeScenario.id,
        condition: condition ?? StudyCondition.LEARNER_DIRECTED,
        closingPosition: position,
        delta: computedDelta,
        extra: { closingReflection: reflection },
      });
      logCat100Event('CAT100_SESSION_COMPLETE', logContext, {
        scenarioId: activeScenario.id,
        condition: condition ?? StudyCondition.LEARNER_DIRECTED,
        initialPosition,
        closingPosition: position,
        delta: computedDelta,
        extra: { closingReflection: reflection },
      });
    }
    setPhase('debrief');
  };

  const renderIntro = (scenario: Scenario) => (
    <section className="bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-6 shadow-ambient">
      <h2 className="text-2xl font-headline font-semibold mb-3 text-lyceum-ink">{scenario.title}</h2>
      <p className="text-sm leading-relaxed text-lyceum-ink/85 mb-5">{scenario.scenario}</p>
      <dl className="text-sm space-y-3 mb-6">
        <div>
          <dt className="font-semibold text-lyceum-ink">Key actors</dt>
          <dd className="text-lyceum-ink/85">{scenario.keyActors.join(', ')}</dd>
        </div>
        <div>
          <dt className="font-semibold text-lyceum-ink">Core tension</dt>
          <dd className="text-lyceum-ink/85">{scenario.coreTension}</dd>
        </div>
        <div>
          <dt className="font-semibold text-lyceum-ink">Guiding question</dt>
          <dd className="text-lyceum-ink/85">{scenario.guidingQuestion}</dd>
        </div>
      </dl>

      <h3 className="text-sm font-semibold mb-2 text-lyceum-ink uppercase tracking-wide">Personas in this scenario</h3>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {scenario.personas.map(persona => (
          <PersonaPanelCard key={persona.id} persona={persona} state="disabled" />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPhase('pre')}
        className="w-full py-3 rounded bg-alabama-crimson text-white text-sm font-semibold tracking-wide hover:bg-crimson-dark transition-colors shadow-ambient"
      >
        Start: record my initial position
      </button>
    </section>
  );

  const renderChat = (scenario: Scenario) => (
    <Cat100ChatView
      scenario={scenario}
      language={language}
      condition={condition}
      initialPosition={initialPosition}
      logContext={logContext}
      expectedPersonaTurns={fixedPersonaTurns}
      onFinish={() => setPhase('post')}
    />
  );

  const renderDebrief = (scenario: Scenario) => (
    <section className="bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-6 max-w-2xl mx-auto shadow-ambient">
      <h2 className="text-2xl font-headline font-semibold mb-1 text-lyceum-ink">Session complete</h2>
      <p className="text-sm text-lyceum-muted mb-5">
        Thanks for thinking through “{scenario.title}” with us.
      </p>
      <div className="rounded border border-lyceum-line bg-lyceum-paper-soft p-4 text-sm space-y-2">
        <p>
          <span className="font-semibold text-lyceum-ink">Initial:</span>{' '}
          <span className="font-mono text-lyceum-ink/85">
            {initialPosition?.stance.toUpperCase()} @ {initialPosition?.confidence}%
          </span>
          ; values [{initialPosition?.values.join(', ')}]
        </p>
        <p>
          <span className="font-semibold text-lyceum-ink">Closing:</span>{' '}
          <span className="font-mono text-lyceum-ink/85">
            {closingPosition?.stance.toUpperCase()} @ {closingPosition?.confidence}%
          </span>
          ; values [{closingPosition?.values.join(', ')}]
        </p>
        {delta && (
          <p className="text-lyceum-ink/85">
            <span className="font-semibold text-lyceum-ink">Delta: </span>
            {summarizeDelta(delta)}
          </p>
        )}
        {closingReflection && (
          <p className="text-lyceum-ink/85">
            <span className="font-semibold text-lyceum-ink">Reflection: </span>
            {closingReflection}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 w-full py-2.5 rounded border border-lyceum-line text-sm text-lyceum-ink hover:bg-lyceum-paper-deep transition-colors"
      >
        Back to ETHOBOT
      </button>
    </section>
  );

  // Gate: no identity yet → show access-code form before anything else.
  if (!identity) {
    return <Cat100GatePage onAccept={handleGateAccept} />;
  }

  return (
    <div className="min-h-screen text-lyceum-ink px-6 py-10">
      <div className={`${phase === 'chat' ? 'max-w-6xl' : 'max-w-3xl'} mx-auto`}>
        <button
          onClick={onBack}
          className="text-sm text-alabama-crimson hover:underline mb-6"
        >
          ← Back to ETHOBOT
        </button>
        <h1 className="text-3xl font-headline font-semibold mb-2 text-lyceum-ink">CAT 100 — Persona Dialogue</h1>
        <p className="text-sm text-lyceum-muted mb-2">
          Phase: <span className="font-mono">{phase}</span> · Condition:{' '}
          <span className="font-mono">{conditionLabel}</span>
        </p>
        <p className="text-xs text-lyceum-muted mb-6" data-testid="participant-info">
          Participant <span className="font-mono">{identity.participantId}</span>
          {identity.course && (
            <>
              {' · '}
              <span className="font-mono">{identity.course}</span>
            </>
          )}
          {' · '}
          <span className="font-mono">source={identity.source}</span>
        </p>

        {!activeScenario && (
          <section className="bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-5 shadow-ambient">
            {loadError ? (
              <p className="text-red-700 text-sm">Unable to load scenarios: {loadError}</p>
            ) : (
              <p className="text-sm text-lyceum-muted">Loading scenarios…</p>
            )}
          </section>
        )}

        {activeScenario && phase === 'intro' && renderIntro(activeScenario)}

        {activeScenario && phase === 'pre' && (
          <PreFormPosition scenario={activeScenario} onSubmit={handlePreFormSubmit} />
        )}

        {activeScenario && phase === 'chat' && initialPosition && renderChat(activeScenario)}

        {activeScenario && phase === 'post' && initialPosition && (
          <PostFormPosition
            scenario={activeScenario}
            initialPosition={initialPosition}
            onSubmit={handlePostFormSubmit}
          />
        )}

        {activeScenario && phase === 'debrief' && renderDebrief(activeScenario)}
      </div>
    </div>
  );
};

export default Cat100Page;
