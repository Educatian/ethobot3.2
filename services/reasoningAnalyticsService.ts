import {
  DiscourseStrategy,
  HumanReasoningAnnotation,
  LearnerCoachingViewModel,
  LearnerDiscourseFunction,
  Message,
  PedagogicalMove,
  PedagogicalMovePlan,
  ProblemStage,
  ProviderHealthSnapshot,
  ReasoningAnalyticsSnapshot,
  ReasoningClassifierContext,
  ReasoningClassifierProvider,
  ReasoningSignal,
  ReasoningState,
  ReasoningTurnAnalysis,
  RuntimeStabilitySnapshot,
  StateProbabilityMap,
  StrategyProbabilityMap,
  SwarmAdjudicationTrace,
  SwarmJudgeVote,
  ReviewedCalibrationCorpusEntry,
  ReviewedCalibrationProfile,
  DesignResponseMatrixRow,
  TeacherAnalyticsViewModel,
  MoveEffectivenessSummary,
  TeacherReviewQueueItem,
  TeacherVerificationItem,
} from '../types';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const SWARM_MODEL = 'gemini-2.0-flash';
export const REASONING_DATASET_SCHEMA_VERSION = 'reasoning-dataset/v0.5';
const EMBEDDING_TIMEOUT_MS = 2500;
const SWARM_CALL_TIMEOUT_MS = 1800;
const SWARM_TOTAL_TIMEOUT_MS = 3600;
const MAX_TEXT_EMBEDDING_CACHE_ENTRIES = 48;
const PROVIDER_FAILURE_THRESHOLD = 3;
const PROVIDER_COOLDOWN_MS = 120000;
const REVIEWED_CALIBRATION_MIN_SIMILARITY = 0.16;
const MIN_REVIEWED_CORPUS_PROVIDER_POOL = 4;
const MIN_REVIEWED_CORPUS_PROVIDER_MATCHES = 2;
const REVIEWED_CORPUS_PROVIDER_LABEL = 'reviewed-corpus-vnext@0.1.0';
const REVIEWED_PROFILE_MIN_REVIEWED_COUNT = 6;
const REVIEWED_PROFILE_MIN_LABEL_SUPPORT = 2;
const REVIEWED_PROFILE_PROVIDER_LABEL = 'reviewed-profile-vnext@0.2.0';
const REVIEWED_PROFILE_MERGED_PROVIDER_LABEL = 'reviewed-profile-merged@0.2.0';

type GuardKey = 'embedding' | 'swarm';

type ProviderGuardState = {
  consecutiveFailures: number;
  cooldownUntil: number;
  lastError: string | null;
  forcedOffline: boolean;
};

const STATE_ORDER = [
  ReasoningState.DEONTIC,
  ReasoningState.CONSEQUENTIALIST,
  ReasoningState.PERSPECTIVE,
  ReasoningState.REFLECTIVE,
];

const STRATEGY_ORDER = [
  DiscourseStrategy.SELF_EVALUATION,
  DiscourseStrategy.QUESTIONING,
  DiscourseStrategy.JUSTIFICATION,
  DiscourseStrategy.ASSERTION,
  DiscourseStrategy.INFORMATION_SEEKING,
  DiscourseStrategy.EMPATHY,
];

const ETHICAL_TERMS = [
  'ethic', 'ethical', 'moral', 'fair', 'bias', 'privacy', 'consent', 'accountability', 'justice', 'harm',
  'responsibility', 'rights', 'value', 'dignity', 'surveillance',
  '윤리', '도덕', '공정', '편향', '사생활', '동의', '책임', '정의', '피해', '권리', '가치', '존엄', '감시',
];

const CLOSURE_TERMS = [
  'final answer', 'the answer is', 'we should just', 'obviously', 'simply', 'there is no need', 'conclusion',
  'i choose', 'the best option', 'it is clear', '결론', '답은', '그냥', '당연히', '선택하', '정답', '결론적으로', '분명히',
];

const REFLECTIVE_LANGUAGE_TERMS = [
  'i realize', 'i may be missing', 'i might be wrong', 'on the other hand', 'at the same time', 'i need to reconsider',
  'i overlooked', 'if i step back', 'maybe my first answer', 'ê°€ì •í•´ë³´ë©´', 'ë‹¤ì‹œ ìƒê°', 'ì„±ì°°', 'ë°˜ì„±', 'ë†“ì¹œ', 'ìž˜ëª» ë³¸',
];

const STATE_LEXICONS: Record<ReasoningState, { weight: number; patterns: string[] }> = {
  [ReasoningState.DEONTIC]: {
    weight: 1,
    patterns: [
      'should', 'must', 'duty', 'rule', 'rules', 'law', 'laws', 'policy', 'right', 'wrong', 'obligation',
      'responsibility', 'principle', '해야', '의무', '규칙', '법', '옳', '그르', '책임', '원칙',
    ],
  },
  [ReasoningState.CONSEQUENTIALIST]: {
    weight: 1,
    patterns: [
      'outcome', 'outcomes', 'result', 'results', 'effect', 'effects', 'impact', 'benefit', 'benefits', 'harm',
      'risk', 'cost', 'safer', 'efficiency', 'trade-off', 'tradeoff', '결과', '영향', '효과', '이익',
      '피해', '위험', '비용', '안전', '편익', '절충',
    ],
  },
  [ReasoningState.PERSPECTIVE]: {
    weight: 1.1,
    patterns: [
      'stakeholder', 'stakeholders', 'perspective', 'viewpoint', 'others', 'someone', 'people affected', 'community',
      'student', 'students', 'citizen', 'family', 'feel', 'trust', '입장', '관점', '이해당사자', '다른 사람',
      '타인', '학생', '시민', '공동체', '느낄', '신뢰', '피해자',
    ],
  },
  [ReasoningState.REFLECTIVE]: {
    weight: 1.15,
    patterns: [
      'however', 'on the other hand', 'at the same time', 'reconsider', 'reflect', 'realize', 'balance',
      'although', 'maybe i was', 'in summary', 'but also', '한편', '동시에', '다시 생각', '성찰',
      '반성', '균형', '양면', '하지만', '오히려',
    ],
  },
};

const STRATEGY_LEXICONS: Record<DiscourseStrategy, { weight: number; patterns: string[] }> = {
  [DiscourseStrategy.SELF_EVALUATION]: {
    weight: 1.2,
    patterns: [
      'i think', 'i realize', 'i may be', 'i might be', 'i overlooked', 'my reasoning', 'my assumption',
      'i was focusing', 'i should reconsider', '제가', '내 판단', '내 생각', '내가 놓친', '다시 보면',
      '생각해보니', '편향',
    ],
  },
  [DiscourseStrategy.QUESTIONING]: {
    weight: 1.1,
    patterns: ['?', 'what if', 'why', 'how', 'what about', '어떻게', '왜', '무엇', '정말'],
  },
  [DiscourseStrategy.JUSTIFICATION]: {
    weight: 1,
    patterns: ['because', 'therefore', 'so that', 'which means', 'this is why', 'since', 'because of', '왜냐하면', '그래서', '따라서', '때문에', '즉'],
  },
  [DiscourseStrategy.ASSERTION]: {
    weight: 0.85,
    patterns: ['is', 'are', 'it is', 'they are', '이다', '라고 본다', '분명하다'],
  },
  [DiscourseStrategy.INFORMATION_SEEKING]: {
    weight: 1,
    patterns: ['need more information', 'not enough information', 'depends on data', 'what evidence', 'unknown', 'unclear', '정보가 더', '근거가 더', '불분명', '모르겠', '데이터가 더'],
  },
  [DiscourseStrategy.EMPATHY]: {
    weight: 1.1,
    patterns: ['feel hurt', 'feel unsafe', 'understand their concern', 'respect their fear', 'someone could feel', '상처', '불안', '두렵', '공감', '존중', '이해한다'],
  },
};

const STATE_PROTOTYPES: Record<ReasoningState, string[]> = {
  [ReasoningState.DEONTIC]: [
    'The learner emphasizes rules, duties, principles, rights, and what should or should not be done.',
    'The response is mostly about obligation, policy compliance, or whether an action is morally right or wrong.',
    '학습자는 규칙, 의무, 원칙, 권리, 해야 하는 일과 해서는 안 되는 일을 중심으로 말한다.',
  ],
  [ReasoningState.CONSEQUENTIALIST]: [
    'The learner evaluates outcomes, risks, benefits, harms, and practical trade-offs.',
    'The response compares consequences and asks which action leads to the best or least harmful result.',
    '학습자는 결과, 위험, 이익, 피해, 효율, 절충안을 중심으로 판단한다.',
  ],
  [ReasoningState.PERSPECTIVE]: [
    'The learner compares stakeholder perspectives, lived experiences, and how different groups might feel.',
    'The response shifts between viewpoints and considers how the issue looks from another persons position.',
    '학습자는 이해당사자, 타인의 입장, 공동체의 경험과 감정을 비교한다.',
  ],
  [ReasoningState.REFLECTIVE]: [
    'The learner integrates multiple values, revisits assumptions, and traces how their thinking is changing.',
    'The response balances tensions, acknowledges uncertainty, and reflects on the limits of the initial answer.',
    '학습자는 여러 가치를 통합하고 자신의 전제를 다시 보며 생각의 변화를 성찰한다.',
  ],
};

const STRATEGY_PROTOTYPES: Record<DiscourseStrategy, string[]> = {
  [DiscourseStrategy.SELF_EVALUATION]: [
    'The learner examines their own assumption, bias, limitation, or change in thinking.',
    '학습자는 자신의 판단, 전제, 편향, 사고 변화 자체를 되돌아본다.',
  ],
  [DiscourseStrategy.QUESTIONING]: [
    'The learner asks exploratory questions, probes conditions, or opens uncertainty.',
    '학습자는 질문을 던지며 가능성이나 조건을 탐색한다.',
  ],
  [DiscourseStrategy.JUSTIFICATION]: [
    'The learner explains why a position makes sense and provides reasons or warrants.',
    '학습자는 자신의 입장을 뒷받침하는 이유와 근거를 제시한다.',
  ],
  [DiscourseStrategy.ASSERTION]: [
    'The learner states a position directly without much elaboration.',
    '학습자는 설명보다 단정적인 진술을 중심으로 말한다.',
  ],
  [DiscourseStrategy.INFORMATION_SEEKING]: [
    'The learner asks for more evidence, data, missing facts, or uncertainty reduction.',
    '학습자는 더 많은 정보, 데이터, 근거가 필요하다고 말한다.',
  ],
  [DiscourseStrategy.EMPATHY]: [
    'The learner notices another persons fear, hurt, dignity, or emotional experience.',
    '학습자는 타인의 감정, 불안, 상처, 존엄을 살피며 공감적으로 말한다.',
  ],
};

type PrototypeEmbeddingSet = {
  stateEmbeddings: Record<ReasoningState, number[]>;
  strategyEmbeddings: Record<DiscourseStrategy, number[]>;
};

type SwarmJudgeFocus = 'state' | 'strategy' | 'move';

type SwarmJudgeResponse = {
  confidence?: number;
  rationale?: string;
  predictedState?: string | null;
  predictedStrategy?: string | null;
  predictedMove?: string | null;
};

type SwarmArbiterResponse = {
  finalState?: string | null;
  finalStrategy?: string | null;
  finalMove?: string | null;
  confidence?: number;
  summary?: string;
};

const EMPTY_STATE_MAP = (): StateProbabilityMap => ({
  [ReasoningState.DEONTIC]: 0,
  [ReasoningState.CONSEQUENTIALIST]: 0,
  [ReasoningState.PERSPECTIVE]: 0,
  [ReasoningState.REFLECTIVE]: 0,
});

const EMPTY_STRATEGY_MAP = (): StrategyProbabilityMap => ({
  [DiscourseStrategy.SELF_EVALUATION]: 0,
  [DiscourseStrategy.QUESTIONING]: 0,
  [DiscourseStrategy.JUSTIFICATION]: 0,
  [DiscourseStrategy.ASSERTION]: 0,
  [DiscourseStrategy.INFORMATION_SEEKING]: 0,
  [DiscourseStrategy.EMPATHY]: 0,
});

const learnerStateCopy: Record<ReasoningState, { title: string; summary: string }> = {
  [ReasoningState.DEONTIC]: {
    title: 'You are leaning on rules and principles.',
    summary: 'That is a solid starting point. The next gain usually comes from checking who experiences the rule differently.',
  },
  [ReasoningState.CONSEQUENTIALIST]: {
    title: 'You are weighing outcomes and trade-offs.',
    summary: 'You are already looking at consequences. The next step is to connect those consequences to real people or groups.',
  },
  [ReasoningState.PERSPECTIVE]: {
    title: 'You are comparing stakeholder perspectives.',
    summary: 'This is a strong place to be. Reflection usually deepens when you revisit one of your own assumptions.',
  },
  [ReasoningState.REFLECTIVE]: {
    title: 'You are integrating multiple concerns.',
    summary: 'Your thinking is becoming more balanced. Try tracing what changed in your position so the insight becomes explicit.',
  },
};

const normalizeWhitespace = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const tokenize = (text: string) =>
  normalizeWhitespace(text)
    .split(/[^a-zA-Z0-9가-힣]+/)
    .filter(token => token.length > 1);

const countMatches = (text: string, patterns: string[]) => patterns.filter(pattern => text.includes(pattern)).length;
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const shannonEntropy = (values: number[]) =>
  values.reduce((acc, value) => {
    if (value <= 0) {
      return acc;
    }
    return acc - value * Math.log2(value);
  }, 0);

const average = (values: number[]) =>
  values.length > 0 ? values.reduce((acc, value) => acc + value, 0) / values.length : 0;

const toSoftmaxMap = <T extends string>(scores: Record<T, number>, temperature = 1): Record<T, number> => {
  const entries = Object.entries(scores) as [T, number][];
  const values = entries.map(([, score]) => Math.exp(score * temperature));
  const sum = values.reduce((acc, value) => acc + value, 0) || 1;
  return entries.reduce((acc, [key], index) => {
    acc[key] = values[index] / sum;
    return acc;
  }, {} as Record<T, number>);
};

const buildSignal = (label: string, score: number, matchedTerms: string[], summary: string): ReasoningSignal => ({
  label,
  score,
  matchedTerms,
  summary,
});

const collectScores = <T extends string>(
  text: string,
  lexicons: Record<T, { weight: number; patterns: string[] }>
) => {
  const rawScores = {} as Record<T, number>;
  const signals: ReasoningSignal[] = [];

  (Object.entries(lexicons) as [T, { weight: number; patterns: string[] }][]).forEach(([label, config]) => {
    const matchedTerms = config.patterns.filter(pattern => text.includes(pattern));
    const score = matchedTerms.length * config.weight;
    rawScores[label] = Math.max(0.15, score);
    if (matchedTerms.length > 0) {
      signals.push(
        buildSignal(
          label,
          score,
          matchedTerms,
          `${label} cues detected through ${matchedTerms.slice(0, 3).join(', ')}`
        )
      );
    }
  });

  return { rawScores, signals };
};

const computeCoherence = (text: string, previousLearnerMessage: Message | undefined) => {
  if (!previousLearnerMessage) {
    return 0.55;
  }

  const currentTokens = new Set(tokenize(text));
  const previousTokens = new Set(tokenize(previousLearnerMessage.text));
  const shared = [...currentTokens].filter(token => previousTokens.has(token)).length;
  const overlap = currentTokens.size ? shared / currentTokens.size : 0;
  const connectiveBonus = /(because|therefore|however|그래서|따라서|하지만|한편)/.test(text) ? 0.15 : 0;
  return clamp(0.25 + overlap * 0.8 + connectiveBonus);
};

const computeSemanticNovelty = (messageText: string, previousLearnerMessage: Message | undefined) => {
  if (!previousLearnerMessage) {
    return 0.52;
  }

  const current = new Set(tokenize(messageText));
  const previous = new Set(tokenize(previousLearnerMessage.text));
  const union = new Set([...current, ...previous]);
  if (union.size === 0) {
    return 0.2;
  }
  const intersection = [...current].filter(token => previous.has(token)).length;
  return clamp(1 - intersection / union.size);
};

const addReflectiveBonuses = (text: string, scores: Record<ReasoningState, number>) => {
  if (/(however|but|although|한편|하지만|동시에)/.test(text)) {
    scores[ReasoningState.REFLECTIVE] += 0.9;
  }
  if (/(stakeholder|perspective|입장|관점|이해당사자)/.test(text) && /(balance|trade|reflect|균형|성찰|절충)/.test(text)) {
    scores[ReasoningState.REFLECTIVE] += 0.8;
  }
  if (/(feel|trust|community|학생|시민|공동체)/.test(text)) {
    scores[ReasoningState.PERSPECTIVE] += 0.6;
  }
  if (/(should|must|rule|law|규칙|법|의무)/.test(text) && /(harm|impact|benefit|risk|영향|피해|이익|위험)/.test(text)) {
    scores[ReasoningState.CONSEQUENTIALIST] += 0.35;
  }
};

const addStrategyBonuses = (text: string, scores: Record<DiscourseStrategy, number>) => {
  if (text.includes('?')) {
    scores[DiscourseStrategy.QUESTIONING] += 1.2;
  }
  if (/(need more|not enough|unknown|unclear|더 필요|불분명|모르겠)/.test(text)) {
    scores[DiscourseStrategy.INFORMATION_SEEKING] += 1;
  }
  if (/(because|therefore|since|그래서|따라서|왜냐하면)/.test(text)) {
    scores[DiscourseStrategy.JUSTIFICATION] += 0.7;
  }
  if (/(i realize|i might|i may|my assumption|생각해보니|다시 보면|내 판단|내가 놓친)/.test(text)) {
    scores[DiscourseStrategy.SELF_EVALUATION] += 1;
  }
  if (/(understand|respect|feel unsafe|hurt|공감|존중|상처|불안)/.test(text)) {
    scores[DiscourseStrategy.EMPATHY] += 0.75;
  }
};

const computeTransitionCounts = (sequence: ReasoningState[]) => {
  const counts: Partial<Record<ReasoningState, Partial<Record<ReasoningState, number>>>> = {};
  for (let index = 1; index < sequence.length; index += 1) {
    const previousState = sequence[index - 1];
    const nextState = sequence[index];
    counts[previousState] = counts[previousState] || {};
    counts[previousState]![nextState] = (counts[previousState]![nextState] || 0) + 1;
  }
  return counts;
};

const computeTransitionEntropy = (sequence: ReasoningState[]) => {
  if (sequence.length < 2) {
    return 0;
  }
  const frequencies = STATE_ORDER.map(state => sequence.filter(value => value === state).length / sequence.length);
  return shannonEntropy(frequencies);
};

const getRegulatoryStatus = (
  sequence: ReasoningState[],
  averageEntropy: number,
  requiresReview: boolean
) => {
  if (requiresReview) {
    return 'review' as const;
  }
  const recent = sequence.slice(-3);
  const repeatedState = recent.length === 3 && recent.every(state => state === recent[0]);
  if (repeatedState && averageEntropy < 1) {
    return 'stagnation' as const;
  }
  const uniqueRecentStates = new Set(sequence.slice(-4));
  if (uniqueRecentStates.size >= 3 && averageEntropy > 1.35) {
    return 'fragmentation' as const;
  }
  return 'balanced' as const;
};

const classifyDiscourseFunction = (
  closureProbability: number,
  productiveProbability: number,
  dominantState: ReasoningState | null,
  semanticNovelty: number
): LearnerDiscourseFunction => {
  if (closureProbability > 0.58) {
    return LearnerDiscourseFunction.CLOSURE;
  }
  if (dominantState === ReasoningState.REFLECTIVE || productiveProbability > 0.68) {
    return LearnerDiscourseFunction.DELIBERATIVE;
  }
  if (dominantState === ReasoningState.PERSPECTIVE || semanticNovelty > 0.38 || productiveProbability > 0.48) {
    return LearnerDiscourseFunction.EXPLORATORY;
  }
  return LearnerDiscourseFunction.NEUTRAL;
};

const detectRegulationRisks = (
  text: string,
  stateProbabilities: StateProbabilityMap,
  strategyProbabilities: StrategyProbabilityMap,
  semanticNovelty: number,
  coherence: number,
  productiveProbability: number,
  closureProbability: number,
  dominantState: ReasoningState | null,
  dominantStrategy: DiscourseStrategy | null,
  discourseFunction: LearnerDiscourseFunction
) => {
  const reflectiveCueStrength = clamp(countMatches(text, REFLECTIVE_LANGUAGE_TERMS) / 3);
  const surfaceComplianceRisk = clamp(
    reflectiveCueStrength * 0.3 +
      stateProbabilities[ReasoningState.REFLECTIVE] * 0.15 +
      (dominantStrategy === DiscourseStrategy.ASSERTION ? 0.15 : 0) +
      (dominantStrategy === DiscourseStrategy.SELF_EVALUATION ? -0.08 : 0) +
      (1 - coherence) * 0.2 +
      (1 - semanticNovelty) * 0.1 +
      (1 - productiveProbability) * 0.1
  );

  const prematureConvergenceRisk = clamp(
    closureProbability * 0.55 +
      (discourseFunction === LearnerDiscourseFunction.CLOSURE ? 0.15 : 0) +
      stateProbabilities[ReasoningState.DEONTIC] * 0.08 +
      strategyProbabilities[DiscourseStrategy.ASSERTION] * 0.08 +
      (1 - semanticNovelty) * 0.08 +
      (1 - productiveProbability) * 0.06
  );

  const detectorFlags = [
    ...(surfaceComplianceRisk > 0.62 ? ['Possible surface compliance'] : []),
    ...(prematureConvergenceRisk > 0.68 ? ['Premature convergence risk'] : []),
  ];

  const detectorSignals: ReasoningSignal[] = [
    ...(surfaceComplianceRisk > 0.45
      ? [
          buildSignal(
            'Surface compliance detector',
            surfaceComplianceRisk,
            [
              ...(reflectiveCueStrength > 0.1 ? ['reflective-language'] : []),
              ...(dominantState ? [dominantState] : []),
              ...(dominantStrategy ? [dominantStrategy] : []),
            ],
            'Reflective language may be outpacing actual integration across the learner trajectory.'
          ),
        ]
      : []),
    ...(prematureConvergenceRisk > 0.45
      ? [
          buildSignal(
            'Premature convergence detector',
            prematureConvergenceRisk,
            [
              ...(closureProbability > 0.4 ? ['closure-cues'] : []),
              ...(dominantState ? [dominantState] : []),
              ...(dominantStrategy ? [dominantStrategy] : []),
            ],
            'The learner may be converging on an answer before enough perspective expansion or trade-off testing.'
          ),
        ]
      : []),
  ];

  const detectorExplanation = [
    ...(surfaceComplianceRisk > 0.62
      ? ['Surface compliance detector is elevated: reflective wording is present, but integration signals remain weak.']
      : []),
    ...(prematureConvergenceRisk > 0.68
      ? ['Premature convergence detector is elevated: the learner appears to be closing the dilemma too quickly.']
      : []),
  ];

  return {
    surfaceComplianceRisk,
    prematureConvergenceRisk,
    detectorFlags,
    detectorSignals,
    detectorExplanation,
  };
};

const computeTransitionDiversity = (states: ReasoningState[]) => {
  if (states.length === 0) {
    return 0.25;
  }

  const recentStates = states.slice(-4);
  return clamp(new Set(recentStates).size / Math.max(2, recentStates.length));
};

const computeCdoi = (
  context: ReasoningClassifierContext,
  ethicalDensity: number,
  semanticNovelty: number,
  productiveProbability: number,
  closureProbability: number,
  dominantState: ReasoningState | null,
  dominantStrategy: DiscourseStrategy | null
) => {
  const priorLearnerAnalyses = context.priorAnalyses.filter(entry => entry.sender === 'user');
  const priorStates = priorLearnerAnalyses
    .map(entry => entry.dominantState)
    .filter((state): state is ReasoningState => state !== null);
  const transitionDiversity = computeTransitionDiversity([
    ...priorStates,
    ...(dominantState ? [dominantState] : []),
  ]);
  const previousCdoiValues = priorLearnerAnalyses.map(entry => entry.cdoi).slice(-3);
  const previousAverageCdoi = average(previousCdoiValues);
  const baseOpenness = clamp(
    0.12 +
      ethicalDensity * 0.24 +
      semanticNovelty * 0.19 +
      productiveProbability * 0.24 +
      transitionDiversity * 0.11 -
      closureProbability * 0.2
  );
  const reflectiveIntegrationBoost = clamp(
    (dominantState === ReasoningState.PERSPECTIVE ? 0.04 : 0) +
    (dominantState === ReasoningState.REFLECTIVE ? 0.08 : 0) +
    (dominantStrategy === DiscourseStrategy.SELF_EVALUATION ? 0.05 : 0) +
    (dominantStrategy === DiscourseStrategy.QUESTIONING ? 0.03 : 0)
  );
  const cdoiMomentum = clamp(
    previousCdoiValues.length === 0
      ? 0.5
      : 0.5 + (baseOpenness + reflectiveIntegrationBoost - previousAverageCdoi) * 0.9
  );
  const cdoi = clamp(
    baseOpenness +
      reflectiveIntegrationBoost * 0.6 +
      (cdoiMomentum - 0.5) * 0.14
  );

  return {
    cdoi,
    cdoiMomentum,
    transitionDiversity,
  };
};

const cosineSimilarity = (left: number[], right: number[]) => {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator ? dot / denominator : 0;
};

const averageVectors = (vectors: number[][]) => {
  if (!vectors.length) {
    return [];
  }

  const length = vectors[0].length;
  const accumulator = Array.from({ length }, () => 0);
  vectors.forEach(vector => {
    for (let index = 0; index < length; index += 1) {
      accumulator[index] += vector[index] || 0;
    }
  });
  return accumulator.map(value => value / vectors.length);
};

const blendProbabilityMaps = <T extends string>(
  baseMap: Record<T, number>,
  overlayMap: Record<T, number>,
  overlayWeight = 0.62
) => {
  const keys = Object.keys(baseMap) as T[];
  const blended = {} as Record<T, number>;
  keys.forEach(key => {
    blended[key] = baseMap[key] * (1 - overlayWeight) + overlayMap[key] * overlayWeight;
  });

  const total = keys.reduce((acc, key) => acc + blended[key], 0) || 1;
  keys.forEach(key => {
    blended[key] /= total;
  });
  return blended;
};

const createTokenWeightBuckets = <T extends string>(labels: readonly T[]) =>
  labels.reduce((acc, label) => {
    acc[label] = {};
    return acc;
  }, {} as Record<T, Record<string, number>>);

const scoreTokenWeights = (tokenWeights: Record<string, number> | undefined, tokens: string[]) => {
  if (!tokenWeights || tokens.length === 0) {
    return 0;
  }

  const uniqueTokens = new Set(tokens);
  const matchedWeight = [...uniqueTokens].reduce((acc, token) => acc + (tokenWeights[token] || 0), 0);
  const totalWeight = Object.values(tokenWeights).reduce((acc, value) => acc + value, 0);
  if (!totalWeight) {
    return 0;
  }

  return clamp(matchedWeight / totalWeight);
};

const parseEnumValue = <T extends Record<string, string>>(enumObject: T, rawValue: string | null | undefined): T[keyof T] | null => {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.toLowerCase().trim();
  const matchedValue = (Object.values(enumObject) as string[]).find(value => value.toLowerCase() === normalized);
  return (matchedValue as T[keyof T] | undefined) || null;
};

const createConsensusMap = <T extends string>(
  options: readonly T[],
  selected: T | null,
  confidence = 0.75
) => {
  const safeConfidence = clamp(confidence, 0.4, 0.92);
  const fallbackShare = options.length > 1 ? (1 - safeConfidence) / (options.length - 1) : 1;

  return options.reduce((acc, option) => {
    acc[option] = selected
      ? option === selected
        ? safeConfidence
        : fallbackShare
      : 1 / options.length;
    return acc;
  }, {} as Record<T, number>);
};

const shouldTriggerSwarm = (analysis: ReasoningTurnAnalysis) => {
  if (analysis.requiresReview) {
    return 'low-confidence classification';
  }
  if (analysis.confidence < 0.42 || analysis.uncertainty > 0.58) {
    return 'ambiguous reasoning pattern';
  }
  if (analysis.closureProbability > 0.72) {
    return 'premature convergence risk';
  }
  if (analysis.prematureConvergenceRisk > 0.76) {
    return 'premature convergence detector spike';
  }
  if (analysis.surfaceComplianceRisk > 0.72) {
    return 'possible surface compliance';
  }
  return null;
};

const buildSwarmCompactContext = (context: ReasoningClassifierContext, baseAnalysis: ReasoningTurnAnalysis) => {
  const recentTurns = context.priorMessages
    .slice(-4)
    .map(message => `${message.sender}: ${message.text}`)
    .join('\n');

  const stateSummary = STATE_ORDER
    .map(state => `${state}: ${baseAnalysis.stateProbabilities[state].toFixed(2)}`)
    .join(', ');
  const strategySummary = STRATEGY_ORDER
    .map(strategy => `${strategy}: ${baseAnalysis.strategyProbabilities[strategy].toFixed(2)}`)
    .join(', ');

  return [
    'Recent dialogue:',
    recentTurns || 'none',
    '',
    'Learner utterance:',
    context.message.text,
    '',
    `Base state probabilities: ${stateSummary}`,
    `Base strategy probabilities: ${strategySummary}`,
    `Base confidence: ${baseAnalysis.confidence.toFixed(2)}`,
    `Base coherence: ${baseAnalysis.coherence.toFixed(2)}`,
    `Base closure risk: ${baseAnalysis.closureProbability.toFixed(2)}`,
    `Base CDOI: ${baseAnalysis.cdoi.toFixed(2)}`,
  ].join('\n');
};

export const buildReviewedCalibrationProfile = (
  corpusEntries: ReviewedCalibrationCorpusEntry[]
): ReviewedCalibrationProfile | null => {
  if (!corpusEntries.length) {
    return null;
  }

  const stateSupport = {} as Partial<Record<ReasoningState, number>>;
  const strategySupport = {} as Partial<Record<DiscourseStrategy, number>>;
  const stateTermWeights = createTokenWeightBuckets(STATE_ORDER);
  const strategyTermWeights = createTokenWeightBuckets(STRATEGY_ORDER);
  let reviewedCount = 0;
  let adjustedCount = 0;

  corpusEntries.forEach(entry => {
    const tokens = tokenize(entry.text);
    if (!tokens.length) {
      return;
    }

    reviewedCount += 1;
    if (entry.reviewDecision === 'adjusted') {
      adjustedCount += 1;
    }

    const baseWeight = entry.reviewDecision === 'adjusted' ? 1.2 : 0.95;

    if (entry.annotatedState) {
      stateSupport[entry.annotatedState] = (stateSupport[entry.annotatedState] || 0) + 1;
      tokens.forEach(token => {
        stateTermWeights[entry.annotatedState!][token] =
          (stateTermWeights[entry.annotatedState!][token] || 0) + baseWeight;
      });
    }

    if (entry.annotatedStrategy) {
      strategySupport[entry.annotatedStrategy] = (strategySupport[entry.annotatedStrategy] || 0) + 1;
      tokens.forEach(token => {
        strategyTermWeights[entry.annotatedStrategy!][token] =
          (strategyTermWeights[entry.annotatedStrategy!][token] || 0) + baseWeight;
      });
    }
  });

  if (!reviewedCount) {
    return null;
  }

  return {
    schemaVersion: REASONING_DATASET_SCHEMA_VERSION,
    providerLabel: REVIEWED_PROFILE_PROVIDER_LABEL,
    generatedAt: new Date().toISOString(),
    reviewedCount,
    adjustedCount,
    stateSupport,
    strategySupport,
    stateTermWeights,
    strategyTermWeights,
  };
};

const mergeLabelSupports = <T extends string>(
  left: Partial<Record<T, number>>,
  right: Partial<Record<T, number>>,
  labels: readonly T[]
) =>
  labels.reduce((acc, label) => {
    const total = (left[label] || 0) + (right[label] || 0);
    if (total > 0) {
      acc[label] = total;
    }
    return acc;
  }, {} as Partial<Record<T, number>>);

const mergeTokenWeightMaps = <T extends string>(
  left: Partial<Record<T, Record<string, number>>>,
  right: Partial<Record<T, Record<string, number>>>,
  labels: readonly T[]
) =>
  labels.reduce((acc, label) => {
    const mergedEntries = new Map<string, number>();
    const mergeSource = (source?: Record<string, number>) => {
      if (!source) {
        return;
      }
      Object.entries(source).forEach(([token, weight]) => {
        mergedEntries.set(token, (mergedEntries.get(token) || 0) + weight);
      });
    };

    mergeSource(left[label]);
    mergeSource(right[label]);

    if (mergedEntries.size > 0) {
      acc[label] = Object.fromEntries(mergedEntries);
    }
    return acc;
  }, {} as Partial<Record<T, Record<string, number>>>);

export const mergeReviewedCalibrationProfiles = (
  ...profiles: Array<ReviewedCalibrationProfile | null | undefined>
): ReviewedCalibrationProfile | null => {
  const validProfiles = profiles.filter(Boolean) as ReviewedCalibrationProfile[];
  if (!validProfiles.length) {
    return null;
  }
  if (validProfiles.length === 1) {
    return validProfiles[0];
  }

  return validProfiles.reduce((merged, profile) => ({
    schemaVersion: REASONING_DATASET_SCHEMA_VERSION,
    providerLabel: REVIEWED_PROFILE_MERGED_PROVIDER_LABEL,
    generatedAt: new Date().toISOString(),
    reviewedCount: merged.reviewedCount + profile.reviewedCount,
    adjustedCount: merged.adjustedCount + profile.adjustedCount,
    stateSupport: mergeLabelSupports(merged.stateSupport, profile.stateSupport, STATE_ORDER),
    strategySupport: mergeLabelSupports(merged.strategySupport, profile.strategySupport, STRATEGY_ORDER),
    stateTermWeights: mergeTokenWeightMaps(merged.stateTermWeights, profile.stateTermWeights, STATE_ORDER),
    strategyTermWeights: mergeTokenWeightMaps(
      merged.strategyTermWeights,
      profile.strategyTermWeights,
      STRATEGY_ORDER
    ),
  }));
};

export const isReviewedCalibrationProfile = (value: unknown): value is ReviewedCalibrationProfile => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReviewedCalibrationProfile> & { profile?: unknown };
  const profile = (candidate.profile && typeof candidate.profile === 'object'
    ? candidate.profile
    : candidate) as Partial<ReviewedCalibrationProfile>;

  return (
    typeof profile.schemaVersion === 'string' &&
    typeof profile.providerLabel === 'string' &&
    typeof profile.generatedAt === 'string' &&
    typeof profile.reviewedCount === 'number' &&
    typeof profile.adjustedCount === 'number' &&
    !!profile.stateSupport &&
    !!profile.strategySupport &&
    !!profile.stateTermWeights &&
    !!profile.strategyTermWeights
  );
};

export const predictWithReviewedCalibrationProfile = (
  text: string,
  reviewedProfile: ReviewedCalibrationProfile | null
) => {
  if (!reviewedProfile || reviewedProfile.reviewedCount < REVIEWED_PROFILE_MIN_REVIEWED_COUNT) {
    return {
      providerLabel: reviewedProfile?.providerLabel || REVIEWED_PROFILE_PROVIDER_LABEL,
      predictedState: null as ReasoningState | null,
      predictedStrategy: null as DiscourseStrategy | null,
      stateConfidence: null as number | null,
      strategyConfidence: null as number | null,
    };
  }

  const currentTokens = tokenize(text);
  if (!currentTokens.length) {
    return {
      providerLabel: reviewedProfile.providerLabel,
      predictedState: null as ReasoningState | null,
      predictedStrategy: null as DiscourseStrategy | null,
      stateConfidence: null as number | null,
      strategyConfidence: null as number | null,
    };
  }

  const stateScoreMap = STATE_ORDER.reduce((acc, state) => {
    const support = reviewedProfile.stateSupport[state] || 0;
    acc[state] =
      support >= REVIEWED_PROFILE_MIN_LABEL_SUPPORT
        ? scoreTokenWeights(reviewedProfile.stateTermWeights[state], currentTokens) * (1 + support * 0.08)
        : 0;
    return acc;
  }, {} as Record<ReasoningState, number>);
  const strategyScoreMap = STRATEGY_ORDER.reduce((acc, strategy) => {
    const support = reviewedProfile.strategySupport[strategy] || 0;
    acc[strategy] =
      support >= REVIEWED_PROFILE_MIN_LABEL_SUPPORT
        ? scoreTokenWeights(reviewedProfile.strategyTermWeights[strategy], currentTokens) * (1 + support * 0.07)
        : 0;
    return acc;
  }, {} as Record<DiscourseStrategy, number>);

  const hasStateSupport = Object.values(stateScoreMap).some(score => score > 0);
  const hasStrategySupport = Object.values(strategyScoreMap).some(score => score > 0);
  const stateProbabilities = hasStateSupport ? toSoftmaxMap(stateScoreMap, 6) : null;
  const strategyProbabilities = hasStrategySupport ? toSoftmaxMap(strategyScoreMap, 6) : null;
  const sortedStates = stateProbabilities
    ? (Object.entries(stateProbabilities) as [ReasoningState, number][]).sort((left, right) => right[1] - left[1])
    : [];
  const sortedStrategies = strategyProbabilities
    ? (Object.entries(strategyProbabilities) as [DiscourseStrategy, number][]).sort((left, right) => right[1] - left[1])
    : [];
  const topState = sortedStates[0];
  const secondState = sortedStates[1];
  const topStrategy = sortedStrategies[0];
  const secondStrategy = sortedStrategies[1];
  const stateConfidence = topState ? clamp(topState[1] - (secondState?.[1] || 0) + topState[1] * 0.45) : null;
  const strategyConfidence = topStrategy
    ? clamp(topStrategy[1] - (secondStrategy?.[1] || 0) + topStrategy[1] * 0.3)
    : null;

  return {
    providerLabel: reviewedProfile.providerLabel,
    predictedState: stateConfidence !== null && stateConfidence >= 0.2 ? topState?.[0] || null : null,
    predictedStrategy: strategyConfidence !== null && strategyConfidence >= 0.18 ? topStrategy?.[0] || null : null,
    stateConfidence,
    strategyConfidence,
  };
};

const applyReviewedCalibrationProfile = (
  context: ReasoningClassifierContext,
  baseAnalysis: ReasoningTurnAnalysis,
  reviewedProfile: ReviewedCalibrationProfile | null
) => {
  if (!reviewedProfile || reviewedProfile.reviewedCount < REVIEWED_PROFILE_MIN_REVIEWED_COUNT) {
    return baseAnalysis;
  }

  const currentTokens = tokenize(context.message.text);
  if (!currentTokens.length) {
    return baseAnalysis;
  }

  const stateScoreMap = STATE_ORDER.reduce((acc, state) => {
    const support = reviewedProfile.stateSupport[state] || 0;
    acc[state] =
      support >= REVIEWED_PROFILE_MIN_LABEL_SUPPORT
        ? scoreTokenWeights(reviewedProfile.stateTermWeights[state], currentTokens) * (1 + support * 0.08)
        : 0;
    return acc;
  }, {} as Record<ReasoningState, number>);
  const strategyScoreMap = STRATEGY_ORDER.reduce((acc, strategy) => {
    const support = reviewedProfile.strategySupport[strategy] || 0;
    acc[strategy] =
      support >= REVIEWED_PROFILE_MIN_LABEL_SUPPORT
        ? scoreTokenWeights(reviewedProfile.strategyTermWeights[strategy], currentTokens) * (1 + support * 0.07)
        : 0;
    return acc;
  }, {} as Record<DiscourseStrategy, number>);

  const hasStateSupport = Object.values(stateScoreMap).some(score => score > 0);
  const hasStrategySupport = Object.values(strategyScoreMap).some(score => score > 0);
  if (!hasStateSupport && !hasStrategySupport) {
    return baseAnalysis;
  }

  const profileStateProbabilities = hasStateSupport
    ? { ...EMPTY_STATE_MAP(), ...toSoftmaxMap(stateScoreMap, 6) }
    : null;
  const profileStrategyProbabilities = hasStrategySupport
    ? { ...EMPTY_STRATEGY_MAP(), ...toSoftmaxMap(strategyScoreMap, 6) }
    : null;

  const calibratedStateProbabilities = profileStateProbabilities
    ? blendProbabilityMaps(baseAnalysis.stateProbabilities, profileStateProbabilities, 0.76)
    : baseAnalysis.stateProbabilities;
  const calibratedStrategyProbabilities = profileStrategyProbabilities
    ? blendProbabilityMaps(baseAnalysis.strategyProbabilities, profileStrategyProbabilities, 0.74)
    : baseAnalysis.strategyProbabilities;

  return completeAnalysis(
    context,
    baseAnalysis,
    calibratedStateProbabilities,
    calibratedStrategyProbabilities,
    reviewedProfile.providerLabel,
    [
      buildSignal(
        'Reviewed profile provider',
        clamp(reviewedProfile.reviewedCount / 10),
        [
          `${reviewedProfile.reviewedCount} reviewed turns`,
          `${reviewedProfile.adjustedCount} adjusted`,
        ],
        'A persistent reviewed-corpus profile was applied before the live session overlay.'
      ),
    ],
    [
      `Persistent reviewed profile ${reviewedProfile.providerLabel} contributed ${reviewedProfile.reviewedCount} reviewed turns before session-specific calibration.`,
    ]
  );
};

const buildReviewedCalibrationMaps = (
  context: ReasoningClassifierContext,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation>
) => {
  const priorUserMessages = context.priorMessages.filter(message => message.sender === 'user');
  const currentTokens = new Set(tokenize(context.message.text));
  if (currentTokens.size === 0) {
    return null;
  }

  const stateScores = EMPTY_STATE_MAP();
  const strategyScores = EMPTY_STRATEGY_MAP();
  let matchedExamples = 0;
  let reviewedPoolSize = 0;
  let adjustedMatches = 0;
  let confirmedMatches = 0;
  let stateSupport = 0;
  let strategySupport = 0;
  let cumulativeSimilarity = 0;

  priorUserMessages.forEach(message => {
    const annotation = annotationsByMessageId[message.id];
    if (!annotation) {
      return;
    }
    reviewedPoolSize += 1;

    const previousTokens = new Set(tokenize(message.text));
    const union = new Set([...currentTokens, ...previousTokens]);
    if (union.size === 0) {
      return;
    }

    const intersectionCount = [...currentTokens].filter(token => previousTokens.has(token)).length;
    const similarity = clamp(intersectionCount / union.size);
    if (similarity < REVIEWED_CALIBRATION_MIN_SIMILARITY) {
      return;
    }

    matchedExamples += 1;
    cumulativeSimilarity += similarity;
    if (annotation.reviewDecision === 'adjusted') {
      adjustedMatches += 1;
    } else {
      confirmedMatches += 1;
    }
    const weight = similarity * (annotation.reviewDecision === 'adjusted' ? 1.15 : 0.9);

    if (annotation.annotatedState) {
      stateSupport += 1;
      stateScores[annotation.annotatedState] += weight;
    }

    if (annotation.annotatedStrategy) {
      strategySupport += 1;
      strategyScores[annotation.annotatedStrategy] += weight;
    }
  });

  if (matchedExamples === 0 || (stateSupport === 0 && strategySupport === 0)) {
    return null;
  }

  const stateProbabilities = stateSupport
    ? toSoftmaxMap(
        STATE_ORDER.reduce((acc, state) => {
          acc[state] = stateScores[state];
          return acc;
        }, {} as Record<ReasoningState, number>),
        5
      )
    : null;
  const strategyProbabilities = strategySupport
    ? toSoftmaxMap(
        STRATEGY_ORDER.reduce((acc, strategy) => {
          acc[strategy] = strategyScores[strategy];
          return acc;
        }, {} as Record<DiscourseStrategy, number>),
        5
      )
    : null;

  return {
    matchedExamples,
    reviewedPoolSize,
    adjustedMatches,
    confirmedMatches,
    stateSupport,
    strategySupport,
    averageSimilarity: cumulativeSimilarity / matchedExamples,
    stateProbabilities: stateProbabilities ? { ...EMPTY_STATE_MAP(), ...stateProbabilities } : null,
    strategyProbabilities: strategyProbabilities
      ? { ...EMPTY_STRATEGY_MAP(), ...strategyProbabilities }
      : null,
  };
};

const applyReviewedCalibration = (
  context: ReasoningClassifierContext,
  baseAnalysis: ReasoningTurnAnalysis,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation>
) => {
  const calibration = buildReviewedCalibrationMaps(context, annotationsByMessageId);
  if (!calibration) {
    return baseAnalysis;
  }

  const qualifiesForReviewedProvider =
    calibration.reviewedPoolSize >= MIN_REVIEWED_CORPUS_PROVIDER_POOL &&
    calibration.matchedExamples >= MIN_REVIEWED_CORPUS_PROVIDER_MATCHES &&
    (calibration.stateSupport >= MIN_REVIEWED_CORPUS_PROVIDER_MATCHES ||
      calibration.strategySupport >= MIN_REVIEWED_CORPUS_PROVIDER_MATCHES);

  const calibratedStateProbabilities = calibration.stateProbabilities
    ? blendProbabilityMaps(
        baseAnalysis.stateProbabilities,
        calibration.stateProbabilities,
        qualifiesForReviewedProvider ? 0.84 : 0.72
      )
    : baseAnalysis.stateProbabilities;
  const calibratedStrategyProbabilities = calibration.strategyProbabilities
    ? blendProbabilityMaps(
        baseAnalysis.strategyProbabilities,
        calibration.strategyProbabilities,
        qualifiesForReviewedProvider ? 0.82 : 0.74
      )
    : baseAnalysis.strategyProbabilities;

  const providerLabel = qualifiesForReviewedProvider
    ? REVIEWED_CORPUS_PROVIDER_LABEL
    : `${baseAnalysis.providerLabel} + reviewed-calibration`;
  const signalLabel = qualifiesForReviewedProvider
    ? 'Reviewed corpus provider'
    : 'Reviewed calibration overlay';
  const signalSummary = qualifiesForReviewedProvider
    ? 'A reviewed annotation corpus with enough matched examples took precedence over the default live provider.'
    : 'Prior reviewed turns with similar wording were used to recalibrate the current state and strategy read.';
  const calibrationStrength = qualifiesForReviewedProvider
    ? clamp((calibration.matchedExamples + calibration.averageSimilarity) / 4)
    : clamp(calibration.matchedExamples / 3);
  const explanation = qualifiesForReviewedProvider
    ? `Reviewed corpus provider matched ${calibration.matchedExamples} prior annotated learner turns from a pool of ${calibration.reviewedPoolSize} reviews, so the live read was promoted to ${REVIEWED_CORPUS_PROVIDER_LABEL}.`
    : `Reviewed calibration matched ${calibration.matchedExamples} prior annotated learner turns and blended their labels into the current read.`;

  return completeAnalysis(
    context,
    baseAnalysis,
    calibratedStateProbabilities,
    calibratedStrategyProbabilities,
    providerLabel,
    [
      buildSignal(
        signalLabel,
        calibrationStrength,
        [
          `${calibration.matchedExamples} reviewed examples`,
          `${calibration.reviewedPoolSize} reviewed pool`,
          `${calibration.adjustedMatches} adjusted`,
          `${calibration.confirmedMatches} confirmed`,
        ],
        signalSummary
      ),
    ],
    [
      explanation,
      `Reviewed calibration used ${calibration.stateSupport} state supports and ${calibration.strategySupport} strategy supports with ${(calibration.averageSimilarity * 100).toFixed(0)}% average similarity.`,
    ]
  );
};

const createMovePlan = (
  analysis: ReasoningTurnAnalysis,
  regulatoryStatus: ReasoningAnalyticsSnapshot['regulatoryStatus']
): PedagogicalMovePlan => {
  if (analysis.requiresReview) {
    return {
      selectedAtMessageId: analysis.messageId,
      source: 'automatic',
      primaryMove: PedagogicalMove.GENERAL_GUIDANCE,
      secondaryMove: PedagogicalMove.JUSTIFICATION_REQUEST,
      rationale: 'The turn is low-confidence, so the system should keep the dialogue open while clarifying the learner position.',
      instructionDirectives: [
        'Do not provide a conclusion.',
        'Ask the learner to restate the core claim in one sentence.',
        'Request one concrete reason and one affected stakeholder.',
      ],
      learnerFacingNudge: 'Try restating your view in one sentence, then name one reason and one affected person.',
    };
  }

  if (analysis.surfaceComplianceRisk > 0.62) {
    return {
      selectedAtMessageId: analysis.messageId,
      source: 'automatic',
      primaryMove: PedagogicalMove.SELF_EVALUATION_PROMPT,
      secondaryMove: PedagogicalMove.JUSTIFICATION_REQUEST,
      rationale: 'The learner sounds reflective on the surface, but the detector suggests the integration may still be shallow, so the system should ask for assumption-checking and explicit justification.',
      instructionDirectives: [
        'Do not praise the current answer as fully reflective yet.',
        'Ask which assumption in the learner answer still feels weakest.',
        'Request a concrete justification that connects the revised answer to a stakeholder or value conflict.',
      ],
      learnerFacingNudge: 'Pause and check which assumption in your answer still feels weakest, then justify how your revised view fits the people affected.',
    };
  }

  const shouldRunClosurePerspectiveSequence =
    (analysis.prematureConvergenceRisk > 0.66 || analysis.closureProbability > 0.6 || regulatoryStatus === 'stagnation') &&
    (
      analysis.dominantState === ReasoningState.DEONTIC ||
      analysis.discourseFunction === LearnerDiscourseFunction.CLOSURE ||
      analysis.dominantStrategy === DiscourseStrategy.ASSERTION
    );

  if (shouldRunClosurePerspectiveSequence) {
    return {
      selectedAtMessageId: analysis.messageId,
      source: 'automatic',
      primaryMove: PedagogicalMove.CLOSURE_DELAY,
      secondaryMove: PedagogicalMove.COUNTER_PERSPECTIVE,
      rationale: 'The learner is moving toward early closure from a narrow frame, so the system should first delay convergence and then reopen the dilemma through a contrasting stakeholder perspective.',
      instructionDirectives: [
        'Do not validate the learner answer as final.',
        'Explicitly state that one more angle needs to be tested before settling the judgment.',
        'After reopening the dilemma, introduce a stakeholder or lived perspective that challenges the current frame.',
        'Ask how the learner answer changes after holding both conditions together.',
      ],
      learnerFacingNudge: 'Hold your answer open for one more turn, then test it from a stakeholder view that could challenge your current conclusion.',
    };
  }

  if (analysis.closureProbability > 0.6 || regulatoryStatus === 'stagnation') {
    const secondaryMove =
      analysis.dominantState === ReasoningState.DEONTIC
        ? PedagogicalMove.COUNTER_PERSPECTIVE
        : PedagogicalMove.VALUE_PROBE;
    return {
      selectedAtMessageId: analysis.messageId,
      source: 'automatic',
      primaryMove: PedagogicalMove.CLOSURE_DELAY,
      secondaryMove,
      rationale: 'The learner appears close to premature convergence, so the system should delay closure and reopen the dilemma space.',
      instructionDirectives: [
        'Do not validate the learner answer as final.',
        'Explicitly keep the dilemma open.',
        'Ask for one more condition, trade-off, or stakeholder perspective before closure.',
      ],
      learnerFacingNudge: 'Pause the conclusion and test what the answer looks like under one more condition or perspective.',
    };
  }

  if (analysis.dominantState === ReasoningState.DEONTIC) {
    return {
      selectedAtMessageId: analysis.messageId,
      source: 'automatic',
      primaryMove: PedagogicalMove.COUNTER_PERSPECTIVE,
      secondaryMove: PedagogicalMove.CLOSURE_DELAY,
      rationale: 'Rule-based reasoning needs conceptual expansion before reflection becomes likely.',
      instructionDirectives: [
        'Introduce a stakeholder whose experience complicates the current rule-based answer.',
        'Delay any closure or recommendation.',
        'Ask how the learner would revise the answer after considering that stakeholder.',
      ],
      learnerFacingNudge: 'Look at the same issue from a stakeholder view that could challenge your current rule-based answer.',
    };
  }

  if (analysis.dominantState === ReasoningState.CONSEQUENTIALIST) {
    return {
      selectedAtMessageId: analysis.messageId,
      source: 'automatic',
      primaryMove: PedagogicalMove.VALUE_PROBE,
      secondaryMove: PedagogicalMove.COUNTER_PERSPECTIVE,
      rationale: 'Outcome reasoning should be tied to explicit values and human perspectives to deepen deliberation.',
      instructionDirectives: [
        'Ask which value is guiding the learner trade-off.',
        'Then introduce a stakeholder who might rank that value differently.',
        'Keep the response exploratory rather than decisive.',
      ],
      learnerFacingNudge: 'Name the value behind your trade-off, then test it from another stakeholder position.',
    };
  }

  if (analysis.dominantState === ReasoningState.PERSPECTIVE && analysis.dominantStrategy !== DiscourseStrategy.SELF_EVALUATION) {
    return {
      selectedAtMessageId: analysis.messageId,
      source: 'automatic',
      primaryMove: PedagogicalMove.SELF_EVALUATION_PROMPT,
      secondaryMove: PedagogicalMove.JUSTIFICATION_REQUEST,
      rationale: 'Perspective-taking is active, so a self-evaluation prompt can help convert it into reflection.',
      instructionDirectives: [
        'Ask the learner which assumption in their own answer now feels least stable.',
        'Request a brief justification for how that assumption changed.',
        'Avoid resolving the dilemma for them.',
      ],
      learnerFacingNudge: 'Revisit one assumption in your own answer and explain what made it feel less stable.',
    };
  }

  if (analysis.dominantState === ReasoningState.REFLECTIVE) {
    return {
      selectedAtMessageId: analysis.messageId,
      source: 'automatic',
      primaryMove: PedagogicalMove.TRADEOFF_EXPLORATION,
      secondaryMove: PedagogicalMove.JUSTIFICATION_REQUEST,
      rationale: 'Reflective reasoning should be consolidated by tracing trade-offs and the path of change.',
      instructionDirectives: [
        'Ask the learner to trace the tension they are balancing rather than declare the issue solved.',
        'Request a short explanation of what changed from their initial position.',
      ],
      learnerFacingNudge: 'Trace the trade-off you are balancing and say what changed from your starting point.',
    };
  }

  return {
    selectedAtMessageId: analysis.messageId,
    source: 'automatic',
    primaryMove: PedagogicalMove.GENERAL_GUIDANCE,
    secondaryMove: PedagogicalMove.VALUE_PROBE,
    rationale: 'Default exploratory support keeps the conversation open while eliciting clearer ethical priorities.',
    instructionDirectives: [
      'Acknowledge the learner point without resolving the dilemma.',
      'Ask a concise value-focused follow-up question.',
    ],
    learnerFacingNudge: 'Clarify the value that matters most in your answer before moving further.',
  };
};

const getInstructorOverrideNudge = (move: PedagogicalMove) => {
  if (move === PedagogicalMove.COUNTER_PERSPECTIVE) {
    return 'Instructor override: use a counter-perspective prompt on the next turn.';
  }
  if (move === PedagogicalMove.JUSTIFICATION_REQUEST) {
    return 'Instructor override: ask the learner to justify the current position before moving on.';
  }
  if (move === PedagogicalMove.VALUE_PROBE) {
    return 'Instructor override: surface the value guiding the learner response.';
  }
  if (move === PedagogicalMove.CLOSURE_DELAY) {
    return 'Instructor override: delay closure and keep the dilemma open for one more turn.';
  }
  if (move === PedagogicalMove.TRADEOFF_EXPLORATION) {
    return 'Instructor override: explore the trade-off structure explicitly on the next turn.';
  }
  if (move === PedagogicalMove.SELF_EVALUATION_PROMPT) {
    return 'Instructor override: prompt the learner to re-examine an assumption.';
  }
  return 'Instructor override: provide general guidance on the next turn.';
};

const getProviderLabel = (provider: Pick<ReasoningClassifierProvider, 'id' | 'version'>) => `${provider.id}@${provider.version}`;

const buildSimilaritySignals = (
  dominantState: ReasoningState,
  dominantStrategy: DiscourseStrategy,
  stateSimilarity: number,
  strategySimilarity: number
) => [
  buildSignal(
    'Embedding state match',
    stateSimilarity,
    [dominantState],
    `Embedding alignment is strongest with ${dominantState}.`
  ),
  buildSignal(
    'Embedding strategy match',
    strategySimilarity,
    [dominantStrategy],
    `Embedding alignment is strongest with ${dominantStrategy}.`
  ),
];

const buildEmbeddingInputText = (context: ReasoningClassifierContext) => {
  const recentTurns = context.priorMessages
    .slice(-4)
    .map(message => `${message.sender}: ${message.text}`)
    .join('\n');

  return [
    'Classify the ethical reasoning state and discourse strategy of the learner utterance.',
    recentTurns ? `Recent context:\n${recentTurns}` : 'Recent context: none',
    `Learner utterance:\n${context.message.text}`,
  ].join('\n\n');
};

let googleGenAiCtor: any | null | undefined;
let googleGenAiCtorPromise: Promise<any | null> | null = null;
let embeddingClient: any | null | undefined;
let prototypeEmbeddingsCache: PrototypeEmbeddingSet | null = null;
let prototypeEmbeddingsPromise: Promise<PrototypeEmbeddingSet | null> | null = null;
const textEmbeddingCache = new Map<string, number[]>();
const providerGuardState: Record<GuardKey, ProviderGuardState> = {
  embedding: {
    consecutiveFailures: 0,
    cooldownUntil: 0,
    lastError: null,
    forcedOffline: false,
  },
  swarm: {
    consecutiveFailures: 0,
    cooldownUntil: 0,
    lastError: null,
    forcedOffline: false,
  },
};

const readFromLruCache = (cache: Map<string, number[]>, key: string) => {
  const value = cache.get(key);
  if (!value) {
    return null;
  }

  cache.delete(key);
  cache.set(key, value);
  return value;
};

const writeToLruCache = (cache: Map<string, number[]>, key: string, value: number[]) => {
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, value);

  while (cache.size > MAX_TEXT_EMBEDDING_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const isGuardCoolingDown = (guardKey: GuardKey) => providerGuardState[guardKey].cooldownUntil > Date.now();

const resetGuard = (guardKey: GuardKey) => {
  providerGuardState[guardKey].consecutiveFailures = 0;
  providerGuardState[guardKey].cooldownUntil = 0;
  providerGuardState[guardKey].lastError = null;
};

const markGuardSuccess = (guardKey: GuardKey) => {
  if (!providerGuardState[guardKey].forcedOffline) {
    resetGuard(guardKey);
  }
};

const markGuardFailure = (guardKey: GuardKey, error: unknown) => {
  const guard = providerGuardState[guardKey];
  if (guard.forcedOffline) {
    return;
  }

  guard.consecutiveFailures += 1;
  guard.lastError = error instanceof Error ? error.message : 'Unknown provider failure';

  if (guard.consecutiveFailures >= PROVIDER_FAILURE_THRESHOLD) {
    guard.cooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
  }
};

const markGuardOffline = (guardKey: GuardKey, reason: string) => {
  providerGuardState[guardKey].forcedOffline = true;
  providerGuardState[guardKey].cooldownUntil = 0;
  providerGuardState[guardKey].consecutiveFailures = 0;
  providerGuardState[guardKey].lastError = reason;
};

const toProviderHealthSnapshot = (guardKey: GuardKey): ProviderHealthSnapshot => {
  const guard = providerGuardState[guardKey];
  const cooldownRemainingMs = Math.max(0, guard.cooldownUntil - Date.now());

  return {
    status: guard.forcedOffline
      ? 'offline'
      : cooldownRemainingMs > 0
        ? 'fallback'
        : guard.consecutiveFailures > 0
          ? 'degraded'
          : 'healthy',
    consecutiveFailures: guard.consecutiveFailures,
    cooldownRemainingMs,
    lastError: guard.lastError,
  };
};

const getRuntimeStabilitySnapshot = (): RuntimeStabilitySnapshot => ({
  embedding: toProviderHealthSnapshot('embedding'),
  swarm: toProviderHealthSnapshot('swarm'),
});

const loadGoogleGenAiCtor = async () => {
  if (googleGenAiCtor !== undefined) {
    return googleGenAiCtor;
  }

  if (!googleGenAiCtorPromise) {
    googleGenAiCtorPromise = import('@google/genai')
      .then(module => module.GoogleGenAI)
      .catch(error => {
        console.warn('Failed to lazy-load @google/genai for reasoning analytics.', error);
        return null;
      });
  }

  googleGenAiCtor = await googleGenAiCtorPromise;
  return googleGenAiCtor;
};

const getEmbeddingClient = async () => {
  if (embeddingClient !== undefined) {
    return embeddingClient;
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    markGuardOffline('embedding', 'VITE_GEMINI_API_KEY is not configured.');
    markGuardOffline('swarm', 'VITE_GEMINI_API_KEY is not configured.');
    embeddingClient = null;
    return embeddingClient;
  }

  const GoogleGenAI = await loadGoogleGenAiCtor();
  if (!GoogleGenAI) {
    markGuardOffline('embedding', 'The Gemini client could not be loaded.');
    markGuardOffline('swarm', 'The Gemini client could not be loaded.');
    embeddingClient = null;
    return embeddingClient;
  }

  embeddingClient = new GoogleGenAI({ apiKey });
  return embeddingClient;
};

const embedTexts = async (texts: string[]) => {
  if (isGuardCoolingDown('embedding')) {
    return null;
  }

  const ai = await getEmbeddingClient();
  if (!ai) {
    return null;
  }

  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
    });

    const embeddings = response.embeddings?.map((embedding: { values?: number[] }) => embedding.values || []) || [];
    if (embeddings.length !== texts.length || embeddings.some((embedding: number[]) => embedding.length === 0)) {
      markGuardFailure('embedding', new Error('Incomplete embedding payload returned.'));
      return null;
    }

    markGuardSuccess('embedding');
    return embeddings;
  } catch (error) {
    markGuardFailure('embedding', error);
    throw error;
  }
};

const getTextEmbedding = async (text: string) => {
  const normalized = normalizeWhitespace(text);
  const cached = readFromLruCache(textEmbeddingCache, normalized);
  if (cached) {
    return cached;
  }

  const embeddings = await embedTexts([text]);
  const embedding = embeddings?.[0] || null;
  if (embedding) {
    writeToLruCache(textEmbeddingCache, normalized, embedding);
  }
  return embedding;
};

const getPrototypeEmbeddings = async (): Promise<PrototypeEmbeddingSet | null> => {
  if (prototypeEmbeddingsCache) {
    return prototypeEmbeddingsCache;
  }

  if (prototypeEmbeddingsPromise) {
    return prototypeEmbeddingsPromise;
  }

  prototypeEmbeddingsPromise = (async () => {
    const statePrototypeEntries = STATE_ORDER.flatMap(state =>
      STATE_PROTOTYPES[state].map(text => ({ label: state, text }))
    );
    const strategyPrototypeEntries = STRATEGY_ORDER.flatMap(strategy =>
      STRATEGY_PROTOTYPES[strategy].map(text => ({ label: strategy, text }))
    );

    const prototypeTexts = [
      ...statePrototypeEntries.map(entry => entry.text),
      ...strategyPrototypeEntries.map(entry => entry.text),
    ];

    const embeddings = await embedTexts(prototypeTexts);
    if (!embeddings) {
      return null;
    }

    let cursor = 0;
    const stateEmbeddings = {} as Record<ReasoningState, number[]>;
    STATE_ORDER.forEach(state => {
      const count = STATE_PROTOTYPES[state].length;
      stateEmbeddings[state] = averageVectors(embeddings.slice(cursor, cursor + count));
      cursor += count;
    });

    const strategyEmbeddings = {} as Record<DiscourseStrategy, number[]>;
    STRATEGY_ORDER.forEach(strategy => {
      const count = STRATEGY_PROTOTYPES[strategy].length;
      strategyEmbeddings[strategy] = averageVectors(embeddings.slice(cursor, cursor + count));
      cursor += count;
    });

    prototypeEmbeddingsCache = {
      stateEmbeddings,
      strategyEmbeddings,
    };

    return prototypeEmbeddingsCache;
  })();

  try {
    return await prototypeEmbeddingsPromise;
  } finally {
    prototypeEmbeddingsPromise = null;
  }
};

const invokeStructuredJudge = async <T>(systemInstruction: string, prompt: string) => {
  if (isGuardCoolingDown('swarm')) {
    return null;
  }

  const ai = await getEmbeddingClient();
  if (!ai) {
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: SWARM_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const payload = response.text;
    if (!payload) {
      markGuardFailure('swarm', new Error('Empty swarm payload returned.'));
      return null;
    }

    const parsed = JSON.parse(payload) as T;
    markGuardSuccess('swarm');
    return parsed;
  } catch (error) {
    markGuardFailure('swarm', error);
    console.warn('Failed to parse swarm JSON response.', error);
    return null;
  }
};

const runSwarmJudge = async (
  focus: SwarmJudgeFocus,
  contextBlock: string
): Promise<SwarmJudgeVote | null> => {
  const focusInstruction =
    focus === 'state'
      ? `You are State Judge. Pick exactly one reasoning state from: ${STATE_ORDER.join(', ')}.`
      : focus === 'strategy'
        ? `You are Strategy Judge. Pick exactly one discourse strategy from: ${STRATEGY_ORDER.join(', ')}.`
        : `You are Move Judge. Pick exactly one pedagogical move from: ${Object.values(PedagogicalMove).join(', ')}.`;

  const response = await withTimeout(
    invokeStructuredJudge<SwarmJudgeResponse>(
      [
        'You are one member of a reasoning-analysis swarm.',
        focusInstruction,
        'Return strict JSON only.',
        'Be concise and use the supplied dialogue context.',
      ].join(' '),
      [
        contextBlock,
        '',
        'Return a JSON object with:',
        '- confidence: number between 0 and 1',
        '- rationale: short string',
        '- predictedState: one state or null',
        '- predictedStrategy: one strategy or null',
        '- predictedMove: one move or null',
      ].join('\n')
    ),
    SWARM_CALL_TIMEOUT_MS,
    `${focus} judge`
  );

  if (!response) {
    return null;
  }

  return {
    judgeId: `${focus}-judge`,
    focus,
    predictedState: parseEnumValue(ReasoningState, response.predictedState),
    predictedStrategy: parseEnumValue(DiscourseStrategy, response.predictedStrategy),
    predictedMove: parseEnumValue(PedagogicalMove, response.predictedMove),
    confidence: clamp(response.confidence ?? 0.45),
    rationale: response.rationale?.trim() || `${focus} judge did not supply a rationale.`,
  };
};

const runSwarmAdjudication = async (
  context: ReasoningClassifierContext,
  baseAnalysis: ReasoningTurnAnalysis,
  triggerReason: string
): Promise<SwarmAdjudicationTrace | null> => {
  if (isGuardCoolingDown('swarm')) {
    return null;
  }

  const ai = await getEmbeddingClient();
  if (!ai) {
    return null;
  }

  const contextBlock = buildSwarmCompactContext(context, baseAnalysis);

  return withTimeout(
    (async () => {
      const judgeVotes = (await Promise.all([
        runSwarmJudge('state', contextBlock),
        runSwarmJudge('strategy', contextBlock),
        runSwarmJudge('move', contextBlock),
      ])).filter((vote): vote is SwarmJudgeVote => vote !== null);

      if (judgeVotes.length < 2) {
        return null;
      }

      const arbiter = await withTimeout(
        invokeStructuredJudge<SwarmArbiterResponse>(
          [
            'You are Swarm Arbiter.',
            'Read the base analysis and judge votes, then output the final state, strategy, and move.',
            `Use only these state labels: ${STATE_ORDER.join(', ')}.`,
            `Use only these strategy labels: ${STRATEGY_ORDER.join(', ')}.`,
            `Use only these move labels: ${Object.values(PedagogicalMove).join(', ')}.`,
            'Return strict JSON only.',
          ].join(' '),
          [
            contextBlock,
            '',
            `Swarm trigger reason: ${triggerReason}`,
            `Base explanation: ${baseAnalysis.explanation.join(' ')}`,
            '',
            'Judge votes:',
            JSON.stringify(judgeVotes, null, 2),
            '',
            'Return a JSON object with:',
            '- finalState: one state or null',
            '- finalStrategy: one strategy or null',
            '- finalMove: one move or null',
            '- confidence: number between 0 and 1',
            '- summary: short string',
          ].join('\n')
        ),
        SWARM_CALL_TIMEOUT_MS,
        'swarm arbiter'
      );

      if (!arbiter) {
        return null;
      }

      return {
        triggerReason,
        judgeVotes,
        arbiterState: parseEnumValue(ReasoningState, arbiter.finalState),
        arbiterStrategy: parseEnumValue(DiscourseStrategy, arbiter.finalStrategy),
        arbiterMove: parseEnumValue(PedagogicalMove, arbiter.finalMove),
        arbiterConfidence: clamp(arbiter.confidence ?? 0.5),
        summary: arbiter.summary?.trim() || 'Swarm arbiter produced a final decision.',
      };
    })(),
    SWARM_TOTAL_TIMEOUT_MS,
    'swarm adjudication'
  );
};

const completeAnalysis = (
  context: ReasoningClassifierContext,
  baseAnalysis: ReasoningTurnAnalysis,
  stateProbabilities: StateProbabilityMap,
  strategyProbabilities: StrategyProbabilityMap,
  providerLabel: string,
  extraSignals: ReasoningSignal[] = [],
  extraExplanation: string[] = []
): ReasoningTurnAnalysis => {
  const sortedStates = (Object.entries(stateProbabilities) as [ReasoningState, number][])
    .sort((left, right) => right[1] - left[1]);
  const sortedStrategies = (Object.entries(strategyProbabilities) as [DiscourseStrategy, number][])
    .sort((left, right) => right[1] - left[1]);

  const [dominantState, topStateScore] = sortedStates[0];
  const secondStateScore = sortedStates[1]?.[1] || 0;
  const [dominantStrategy, topStrategyScore] = sortedStrategies[0];
  const secondStrategyScore = sortedStrategies[1]?.[1] || 0;

  const confidence = clamp(topStateScore - secondStateScore + topStateScore * 0.45);
  const strategyConfidence = clamp(topStrategyScore - secondStrategyScore + topStrategyScore * 0.3);
  const stateEntropy = shannonEntropy(Object.values(stateProbabilities));
  const uncertainty = clamp(Math.max(1 - confidence, stateEntropy / 2));
  const productiveProbability = clamp(
    (stateProbabilities[ReasoningState.PERSPECTIVE] +
      stateProbabilities[ReasoningState.REFLECTIVE] +
      strategyProbabilities[DiscourseStrategy.SELF_EVALUATION] +
      strategyProbabilities[DiscourseStrategy.QUESTIONING]) / 2
  );

  const closureCueStrength = clamp(countMatches(normalizeWhitespace(context.message.text), CLOSURE_TERMS) / 3);
  const closureProbability = clamp(
    closureCueStrength * 0.55 +
      stateProbabilities[ReasoningState.DEONTIC] * 0.2 +
      strategyProbabilities[DiscourseStrategy.ASSERTION] * 0.1 +
      (1 - baseAnalysis.semanticNovelty) * 0.15
  );
  const {
    cdoi,
    cdoiMomentum,
    transitionDiversity,
  } = computeCdoi(
    context,
    baseAnalysis.ethicalDensity,
    baseAnalysis.semanticNovelty,
    productiveProbability,
    closureProbability,
    dominantState,
    dominantStrategy
  );

  const discourseFunction = classifyDiscourseFunction(
    closureProbability,
    productiveProbability,
    dominantState,
    baseAnalysis.semanticNovelty
  );
  const detectorResult = detectRegulationRisks(
    normalizeWhitespace(context.message.text),
    stateProbabilities,
    strategyProbabilities,
    baseAnalysis.semanticNovelty,
    baseAnalysis.coherence,
    productiveProbability,
    closureProbability,
    dominantState,
    dominantStrategy,
    discourseFunction
  );
  const mergedSignals = [...baseAnalysis.signals, ...extraSignals, ...detectorResult.detectorSignals];
  const requiresReview =
    confidence < 0.26 ||
    (topStateScore < 0.34 && mergedSignals.length === 0) ||
    detectorResult.surfaceComplianceRisk > 0.8;
  const resolvedDominantState = requiresReview ? null : dominantState;

  return {
    ...baseAnalysis,
    providerLabel,
    dominantState: resolvedDominantState,
    stateProbabilities,
    dominantStrategy: strategyConfidence < 0.2 ? null : dominantStrategy,
    strategyProbabilities,
    confidence,
    uncertainty,
    stateEntropy,
    productiveProbability,
    closureProbability,
    prematureConvergenceRisk: detectorResult.prematureConvergenceRisk,
    surfaceComplianceRisk: detectorResult.surfaceComplianceRisk,
    cdoi,
    discourseFunction,
    explanation: [
      ...extraExplanation,
      ...detectorResult.detectorExplanation,
      `${dominantState} scored highest for this learner turn.`,
      `${dominantStrategy} is the strongest discourse strategy candidate.`,
      `CDOI is ${(cdoi * 100).toFixed(0)} with ${(closureProbability * 100).toFixed(0)}% closure risk.`,
      `CDOI refinement tracks ${(transitionDiversity * 100).toFixed(0)}% transition diversity and ${(cdoiMomentum * 100).toFixed(0)}% openness momentum.`,
      `Detector risk is ${(detectorResult.surfaceComplianceRisk * 100).toFixed(0)}% for surface compliance and ${(detectorResult.prematureConvergenceRisk * 100).toFixed(0)}% for premature convergence.`,
      `Confidence is ${(confidence * 100).toFixed(0)}% with ${(uncertainty * 100).toFixed(0)}% uncertainty.`,
    ],
    matchedSignals: mergedSignals.flatMap(signal => signal.matchedTerms),
    signals: mergedSignals,
    detectorFlags: detectorResult.detectorFlags,
    requiresReview,
  };
};

const classifyWithHeuristicBaselineSync = (
  context: ReasoningClassifierContext,
  providerLabel: string
): ReasoningTurnAnalysis => {
  const text = normalizeWhitespace(context.message.text);
  const previousLearnerMessage = [...context.priorMessages].reverse().find(message => message.sender === 'user');

  const { rawScores: rawStateScores, signals: stateSignals } = collectScores(text, STATE_LEXICONS);
  const { rawScores: rawStrategyScores, signals: strategySignals } = collectScores(text, STRATEGY_LEXICONS);
  addReflectiveBonuses(text, rawStateScores);
  addStrategyBonuses(text, rawStrategyScores);

  const stateProbabilities = { ...EMPTY_STATE_MAP(), ...toSoftmaxMap(rawStateScores) };
  const strategyProbabilities = { ...EMPTY_STRATEGY_MAP(), ...toSoftmaxMap(rawStrategyScores) };
  const sortedStates = (Object.entries(stateProbabilities) as [ReasoningState, number][]).sort((a, b) => b[1] - a[1]);
  const [dominantState, topStateScore] = sortedStates[0];
  const secondStateScore = sortedStates[1]?.[1] || 0;
  const dominantStrategy = (Object.entries(strategyProbabilities) as [DiscourseStrategy, number][])
    .sort((a, b) => b[1] - a[1])[0][0];
  const confidence = clamp(topStateScore - secondStateScore + topStateScore * 0.4);
  const stateEntropy = shannonEntropy(Object.values(stateProbabilities));
  const coherence = computeCoherence(text, previousLearnerMessage);
  const uncertainty = clamp(stateEntropy / 2);
  const ethicalMatches = countMatches(text, ETHICAL_TERMS);
  const tokens = tokenize(text);
  const ethicalDensity = clamp(tokens.length ? ethicalMatches / Math.max(4, Math.round(tokens.length * 0.25)) : 0);
  const semanticNovelty = computeSemanticNovelty(text, previousLearnerMessage);
  const productiveProbability = clamp(
    (stateProbabilities[ReasoningState.PERSPECTIVE] +
      stateProbabilities[ReasoningState.REFLECTIVE] +
      strategyProbabilities[DiscourseStrategy.SELF_EVALUATION] +
      strategyProbabilities[DiscourseStrategy.QUESTIONING]) / 2
  );
  const closureCueStrength = clamp(countMatches(text, CLOSURE_TERMS) / 3);
  const closureProbability = clamp(
    closureCueStrength * 0.6 + stateProbabilities[ReasoningState.DEONTIC] * 0.25 + (1 - semanticNovelty) * 0.15
  );
  const {
    cdoi,
    cdoiMomentum,
    transitionDiversity,
  } = computeCdoi(
    context,
    ethicalDensity,
    semanticNovelty,
    productiveProbability,
    closureProbability,
    dominantState,
    dominantStrategy
  );
  const discourseFunction = classifyDiscourseFunction(closureProbability, productiveProbability, dominantState, semanticNovelty);
  const detectorResult = detectRegulationRisks(
    text,
    stateProbabilities,
    strategyProbabilities,
    semanticNovelty,
    coherence,
    productiveProbability,
    closureProbability,
    dominantState,
    dominantStrategy,
    discourseFunction
  );
  const requiresReview =
    confidence < 0.28 ||
    (topStateScore < 0.38 && stateSignals.length === 0) ||
    detectorResult.surfaceComplianceRisk > 0.8;

  return {
    messageId: context.message.id,
    sender: context.message.sender,
    providerLabel,
    dominantState: requiresReview ? null : dominantState,
    stateProbabilities,
    dominantStrategy,
    strategyProbabilities,
    confidence,
    uncertainty,
    coherence,
    stateEntropy,
    ethicalDensity,
    semanticNovelty,
    productiveProbability,
    closureProbability,
    prematureConvergenceRisk: detectorResult.prematureConvergenceRisk,
    surfaceComplianceRisk: detectorResult.surfaceComplianceRisk,
    cdoi,
    discourseFunction,
    explanation: [
      ...detectorResult.detectorExplanation,
      `${dominantState} scored highest for this learner turn.`,
      `${dominantStrategy} is the strongest discourse strategy candidate.`,
      `CDOI is ${(cdoi * 100).toFixed(0)} with ${(closureProbability * 100).toFixed(0)}% closure risk.`,
      `CDOI refinement tracks ${(transitionDiversity * 100).toFixed(0)}% transition diversity and ${(cdoiMomentum * 100).toFixed(0)}% openness momentum.`,
      `Detector risk is ${(detectorResult.surfaceComplianceRisk * 100).toFixed(0)}% for surface compliance and ${(detectorResult.prematureConvergenceRisk * 100).toFixed(0)}% for premature convergence.`,
      `Confidence is ${(confidence * 100).toFixed(0)}% with ${(uncertainty * 100).toFixed(0)}% uncertainty.`,
    ],
    matchedSignals: [...stateSignals, ...strategySignals, ...detectorResult.detectorSignals].flatMap(signal => signal.matchedTerms),
    signals: [...stateSignals, ...strategySignals, ...detectorResult.detectorSignals],
    detectorFlags: detectorResult.detectorFlags,
    requiresReview,
  };
};

export const heuristicReasoningProvider: ReasoningClassifierProvider = {
  id: 'explainable-heuristic-baseline',
  version: '0.4.0',
  kind: 'hybrid',
  description: 'Explainable baseline that combines state heuristics, CDOI-style openness signals, and pedagogical move selection.',
  async classifyTurn(context) {
    return classifyWithHeuristicBaselineSync(context, getProviderLabel(heuristicReasoningProvider));
  },
};

export const embeddingReasoningProvider: ReasoningClassifierProvider = {
  id: 'gemini-embedding-hybrid',
  version: '0.1.0',
  kind: 'embedding',
  description: 'Multilingual embedding scorer that aligns learner turns to ethical reasoning prototypes and blends them with the heuristic baseline.',
  async classifyTurn(context) {
    const heuristicAnalysis = classifyWithHeuristicBaselineSync(
      context,
      getProviderLabel(heuristicReasoningProvider)
    );
    const embeddingInput = buildEmbeddingInputText(context);

    try {
      const [prototypeEmbeddings, utteranceEmbedding] = await withTimeout(
        Promise.all([
          getPrototypeEmbeddings(),
          getTextEmbedding(embeddingInput),
        ]),
        EMBEDDING_TIMEOUT_MS,
        'Embedding classification'
      );

      if (!prototypeEmbeddings || !utteranceEmbedding) {
        return {
          ...heuristicAnalysis,
          providerLabel: `${getProviderLabel(heuristicReasoningProvider)} (embedding unavailable)`,
          explanation: [
            'Embedding scorer was unavailable, so the system fell back to the heuristic baseline.',
            ...heuristicAnalysis.explanation,
          ],
        };
      }

      const stateSimilarityScores = STATE_ORDER.reduce((acc, state) => {
        acc[state] = cosineSimilarity(utteranceEmbedding, prototypeEmbeddings.stateEmbeddings[state]);
        return acc;
      }, {} as Record<ReasoningState, number>);
      const strategySimilarityScores = STRATEGY_ORDER.reduce((acc, strategy) => {
        acc[strategy] = cosineSimilarity(utteranceEmbedding, prototypeEmbeddings.strategyEmbeddings[strategy]);
        return acc;
      }, {} as Record<DiscourseStrategy, number>);

      const embeddingStateProbabilities = {
        ...EMPTY_STATE_MAP(),
        ...toSoftmaxMap(stateSimilarityScores, 6),
      };
      const embeddingStrategyProbabilities = {
        ...EMPTY_STRATEGY_MAP(),
        ...toSoftmaxMap(strategySimilarityScores, 6),
      };

      const stateProbabilities = blendProbabilityMaps(
        heuristicAnalysis.stateProbabilities,
        embeddingStateProbabilities
      );
      const strategyProbabilities = blendProbabilityMaps(
        heuristicAnalysis.strategyProbabilities,
        embeddingStrategyProbabilities
      );

      const sortedStates = (Object.entries(embeddingStateProbabilities) as [ReasoningState, number][])
        .sort((left, right) => right[1] - left[1]);
      const sortedStrategies = (Object.entries(embeddingStrategyProbabilities) as [DiscourseStrategy, number][])
        .sort((left, right) => right[1] - left[1]);
      const [embeddingDominantState, embeddingStateScore] = sortedStates[0];
      const [embeddingDominantStrategy, embeddingStrategyScore] = sortedStrategies[0];

      return completeAnalysis(
        context,
        heuristicAnalysis,
        stateProbabilities,
        strategyProbabilities,
        getProviderLabel(embeddingReasoningProvider),
        buildSimilaritySignals(
          embeddingDominantState,
          embeddingDominantStrategy,
          embeddingStateScore,
          embeddingStrategyScore
        ),
        [
          `Embedding alignment is strongest with ${embeddingDominantState} and ${embeddingDominantStrategy}.`,
          'The final label blends multilingual prototype similarity with the explainable heuristic baseline.',
        ]
      );
    } catch (error) {
      console.warn('Embedding provider fell back to heuristic baseline.', error);
      return {
        ...heuristicAnalysis,
        providerLabel: `${getProviderLabel(heuristicReasoningProvider)} (embedding timeout/fallback)`,
        explanation: [
          'Embedding scoring was too slow or failed at runtime, so the system reverted to the heuristic baseline.',
          ...heuristicAnalysis.explanation,
        ],
      };
    }
  },
};

const applySwarmAdjudication = (
  context: ReasoningClassifierContext,
  baseAnalysis: ReasoningTurnAnalysis,
  swarmTrace: SwarmAdjudicationTrace
) => {
  const stateProbabilities = swarmTrace.arbiterState
    ? blendProbabilityMaps(
        baseAnalysis.stateProbabilities,
        createConsensusMap(STATE_ORDER, swarmTrace.arbiterState, swarmTrace.arbiterConfidence),
        0.68
      )
    : baseAnalysis.stateProbabilities;
  const strategyProbabilities = swarmTrace.arbiterStrategy
    ? blendProbabilityMaps(
        baseAnalysis.strategyProbabilities,
        createConsensusMap(STRATEGY_ORDER, swarmTrace.arbiterStrategy, swarmTrace.arbiterConfidence),
        0.68
      )
    : baseAnalysis.strategyProbabilities;

  const adjudicated = completeAnalysis(
    context,
    baseAnalysis,
    stateProbabilities,
    strategyProbabilities,
    getProviderLabel(swarmReasoningProvider),
    [
      buildSignal(
        'Swarm adjudication',
        swarmTrace.arbiterConfidence,
        [
          ...(swarmTrace.arbiterState ? [swarmTrace.arbiterState] : []),
          ...(swarmTrace.arbiterStrategy ? [swarmTrace.arbiterStrategy] : []),
          ...(swarmTrace.arbiterMove ? [swarmTrace.arbiterMove] : []),
        ],
        swarmTrace.summary
      ),
    ],
    [
      `Swarm adjudication was triggered because of ${swarmTrace.triggerReason}.`,
      `Arbiter summary: ${swarmTrace.summary}`,
    ]
  );

  return {
    ...adjudicated,
    swarmTrace,
  };
};

export const swarmReasoningProvider: ReasoningClassifierProvider = {
  id: 'swarm-adjudicated-reasoning',
  version: '0.1.0',
  kind: 'hybrid',
  description: 'Uses the fast embedding classifier for most turns and escalates ambiguous cases to a small adjudication swarm.',
  async classifyTurn(context) {
    const baseAnalysis = await embeddingReasoningProvider.classifyTurn(context);
    const triggerReason = shouldTriggerSwarm(baseAnalysis);
    if (!triggerReason) {
      return baseAnalysis;
    }

    try {
      const swarmTrace = await runSwarmAdjudication(context, baseAnalysis, triggerReason);
      if (!swarmTrace) {
        return {
          ...baseAnalysis,
          explanation: [
            `Swarm adjudication was requested because of ${triggerReason}, but the system stayed with the base analysis.`,
            ...baseAnalysis.explanation,
          ],
        };
      }

      return applySwarmAdjudication(context, baseAnalysis, swarmTrace);
    } catch (error) {
      console.warn('Swarm adjudication fell back to base analysis.', error);
      return {
        ...baseAnalysis,
        explanation: [
          `Swarm adjudication was requested because of ${triggerReason}, but it timed out or failed.`,
          ...baseAnalysis.explanation,
        ],
      };
    }
  },
};

const activeReasoningProvider = swarmReasoningProvider;

export const getReasoningProviderLabel = () => getProviderLabel(activeReasoningProvider);

export const createEmptyReasoningAnalyticsSnapshot = (): ReasoningAnalyticsSnapshot => ({
  analyses: [],
  currentLearnerState: null,
  currentLearnerStrategy: null,
  transitionCounts: {},
  stateSequence: [],
  transitionEntropy: 0,
  averageCoherence: 0,
  regulatoryStatus: 'review',
  suggestedIntervention: 'Reasoning analytics will appear after the first learner turn.',
  suggestedPrompt: 'Ask the learner to explain their view and name an affected stakeholder.',
  cautionFlags: [],
  currentMovePlan: null,
  latestCDOI: 0,
  cdoiHistory: [],
  designResponseTraces: [],
  provider: getReasoningProviderLabel(),
  runtimeStability: getRuntimeStabilitySnapshot(),
});

export const applyInstructorOverride = (
  snapshot: ReasoningAnalyticsSnapshot,
  overrideMove: PedagogicalMove
): ReasoningAnalyticsSnapshot => {
  const existingPlan = snapshot.currentMovePlan;
  const selectedAtMessageId =
    existingPlan?.selectedAtMessageId ||
    [...snapshot.analyses].reverse().find(entry => entry.sender === 'user')?.messageId ||
    'instructor-override';

  const overriddenPlan: PedagogicalMovePlan = {
    selectedAtMessageId,
    source: 'instructor_override',
    primaryMove: overrideMove,
    secondaryMove:
      existingPlan?.primaryMove && existingPlan.primaryMove !== overrideMove
        ? existingPlan.primaryMove
        : existingPlan?.secondaryMove,
    rationale: `Instructor override applied. ${existingPlan?.rationale || 'The next adaptive move should follow supervisory guidance.'}`,
    instructionDirectives: [
      `Instructor override: prioritize ${overrideMove}.`,
      ...(existingPlan?.instructionDirectives || []),
    ],
    learnerFacingNudge: getInstructorOverrideNudge(overrideMove),
  };

  return {
    ...snapshot,
    currentMovePlan: overriddenPlan,
    suggestedIntervention: overriddenPlan.rationale,
    suggestedPrompt: overriddenPlan.learnerFacingNudge,
    cautionFlags: [...new Set([...snapshot.cautionFlags, `Instructor override queued: ${overrideMove}`])],
    runtimeStability: getRuntimeStabilitySnapshot(),
  };
};

export const analyzeLearnerTurn = async (
  message: Message,
  snapshot: ReasoningAnalyticsSnapshot,
  priorMessages: Message[] = [],
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {},
  reviewedProfile: ReviewedCalibrationProfile | null = null
): Promise<ReasoningAnalyticsSnapshot> => {
  if (message.sender !== 'user') {
    return snapshot;
  }

  const classifierContext = {
    message,
    priorMessages,
    priorAnalyses: snapshot.analyses,
  };
  const baseAnalysis = await activeReasoningProvider.classifyTurn(classifierContext);
  const profileAnalysis = applyReviewedCalibrationProfile(classifierContext, baseAnalysis, reviewedProfile);
  const analysis = applyReviewedCalibration(classifierContext, profileAnalysis, annotationsByMessageId);

  const analyses = [...snapshot.analyses, analysis];
  const learnerAnalyses = analyses.filter(entry => entry.sender === 'user');
  const stateSequence = learnerAnalyses
    .filter(entry => entry.dominantState)
    .map(entry => entry.dominantState!) as ReasoningState[];
  const transitionEntropy = computeTransitionEntropy(stateSequence);
  const averageCoherence =
    learnerAnalyses.reduce((acc, entry) => acc + entry.coherence, 0) /
      Math.max(1, learnerAnalyses.length) || 0;
  const averageEntropy =
    learnerAnalyses.reduce((acc, entry) => acc + entry.stateEntropy, 0) /
      Math.max(1, learnerAnalyses.length) || 0;
  const regulatoryStatus = getRegulatoryStatus(stateSequence, averageEntropy, analysis.requiresReview);
  const movePlan = createMovePlan(analysis, regulatoryStatus);

  const designResponseTraces = snapshot.currentMovePlan
    ? [
        ...snapshot.designResponseTraces,
        {
          sourceMessageId: snapshot.currentMovePlan.selectedAtMessageId,
          responseMessageId: analysis.messageId,
          appliedMoves: [snapshot.currentMovePlan.primaryMove, ...(snapshot.currentMovePlan.secondaryMove ? [snapshot.currentMovePlan.secondaryMove] : [])],
          moveSource: snapshot.currentMovePlan.source,
          learnerFunction: analysis.discourseFunction,
          resultingState: analysis.dominantState,
          resultingCDOI: analysis.cdoi,
        },
      ]
    : snapshot.designResponseTraces;

  const cautionFlags = [...new Set([
    ...(analysis.requiresReview ? ['Low-confidence classification'] : []),
    ...analysis.detectorFlags,
  ])];

  return {
    analyses,
    currentLearnerState: analysis.dominantState,
    currentLearnerStrategy: analysis.dominantStrategy,
    transitionCounts: computeTransitionCounts(stateSequence),
    stateSequence,
    transitionEntropy,
    averageCoherence,
    regulatoryStatus,
    suggestedIntervention: movePlan.rationale,
    suggestedPrompt: movePlan.learnerFacingNudge,
    cautionFlags,
    currentMovePlan: movePlan,
    latestCDOI: analysis.cdoi,
    cdoiHistory: [...snapshot.cdoiHistory, analysis.cdoi],
    designResponseTraces,
    provider: analysis.providerLabel,
    runtimeStability: getRuntimeStabilitySnapshot(),
  };
};

export const rebuildReasoningAnalytics = async (
  messages: Message[],
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {},
  reviewedProfile: ReviewedCalibrationProfile | null = null
) => {
  let snapshot = createEmptyReasoningAnalyticsSnapshot();
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.sender !== 'user') {
      continue;
    }
    snapshot = await analyzeLearnerTurn(
      message,
      snapshot,
      messages.slice(0, index),
      annotationsByMessageId,
      reviewedProfile
    );
  }
  return snapshot;
};

export const mapReasoningStateToProblemStage = (state: ReasoningState | null): ProblemStage => {
  if (state === ReasoningState.DEONTIC) {
    return ProblemStage.PROBLEM_DEFINITION;
  }
  if (state === ReasoningState.CONSEQUENTIALIST || state === ReasoningState.PERSPECTIVE) {
    return ProblemStage.SOLUTION_EXPLORATION;
  }
  if (state === ReasoningState.REFLECTIVE) {
    return ProblemStage.REFLECTION;
  }
  return ProblemStage.PROBLEM_DEFINITION;
};

const getLearnerMomentum = (snapshot: ReasoningAnalyticsSnapshot) => {
  if (snapshot.regulatoryStatus === 'stagnation') {
    return 'Your thinking may be circling one idea for a bit too long.';
  }
  if (snapshot.regulatoryStatus === 'fragmentation') {
    return 'You are exploring many angles quickly, so a short pause to organize them will help.';
  }
  if (snapshot.currentLearnerState === ReasoningState.PERSPECTIVE) {
    return 'You are in a productive zone for deeper ethical reflection.';
  }
  if (snapshot.currentLearnerState === ReasoningState.REFLECTIVE) {
    return 'You are moving beyond a first reaction and building a more defensible judgment.';
  }
  return 'You have a workable starting point for deeper ethical reasoning.';
};

const getLearnerReflectionPrompts = (snapshot: ReasoningAnalyticsSnapshot) => {
  if (snapshot.currentLearnerState === ReasoningState.DEONTIC) {
    return [
      'Who might feel the rule differently from you?',
      'What harm could still happen even if the rule is followed?',
    ];
  }
  if (snapshot.currentLearnerState === ReasoningState.CONSEQUENTIALIST) {
    return [
      'Who benefits, and who carries the risk?',
      'Which person in the situation might describe the outcome differently?',
    ];
  }
  if (snapshot.currentLearnerState === ReasoningState.PERSPECTIVE) {
    return [
      'Which assumption of yours would you revisit after hearing that perspective?',
      'What tension do you now see between fairness and protection?',
    ];
  }
  if (snapshot.currentLearnerState === ReasoningState.REFLECTIVE) {
    return [
      'What changed between your first position and your current one?',
      'Which tension are you balancing rather than solving?',
    ];
  }
  return [
    'What point feels most important to you right now?',
    'Whose voice is still missing from your answer?',
  ];
};

const getTeacherMonitoringSummary = (snapshot: ReasoningAnalyticsSnapshot) => {
  if (snapshot.regulatoryStatus === 'review') {
    return 'Automatic adaptation is running, but at least one recent turn needs supervisory attention.';
  }
  if (snapshot.regulatoryStatus === 'stagnation') {
    return 'Automatic adaptation is active; monitor whether closure-delay and perspective moves reopen the dialogue.';
  }
  if (snapshot.regulatoryStatus === 'fragmentation') {
    return 'Automatic adaptation is active; monitor whether the learner begins consolidating rather than scattering across too many angles.';
  }
  return 'Automatic adaptation is active and currently within a stable supervisory range.';
};

const getCdoiTrajectorySummary = (snapshot: ReasoningAnalyticsSnapshot) => {
  const recent = snapshot.cdoiHistory.slice(-4);
  if (recent.length === 0) {
    return {
      label: 'Awaiting trajectory',
      summary: 'CDOI trajectory will appear after learner turns accumulate.',
    };
  }

  const delta = recent[recent.length - 1] - recent[0];
  if (delta > 0.1) {
    return {
      label: 'Rising',
      summary: 'Openness is trending upward across recent turns, suggesting the learner is widening or integrating rather than closing down.',
    };
  }
  if (delta < -0.1) {
    return {
      label: 'Dropping',
      summary: 'Openness is trending downward across recent turns, suggesting the learner may be narrowing too quickly or losing exploratory depth.',
    };
  }
  return {
    label: 'Stable',
    summary: 'Openness is relatively stable across recent turns, so the next intervention should look for either a productive lift or a clean consolidation.',
  };
};

const getSequencePolicySummary = (snapshot: ReasoningAnalyticsSnapshot) => {
  const movePlan = snapshot.currentMovePlan;
  if (!movePlan) {
    return 'No active intervention sequence has been selected yet.';
  }

  if (
    movePlan.primaryMove === PedagogicalMove.CLOSURE_DELAY &&
    movePlan.secondaryMove === PedagogicalMove.COUNTER_PERSPECTIVE
  ) {
    return 'Sequential policy active: first delay closure, then introduce a counter-perspective before allowing consolidation.';
  }

  if (
    movePlan.primaryMove === PedagogicalMove.COUNTER_PERSPECTIVE &&
    movePlan.secondaryMove === PedagogicalMove.CLOSURE_DELAY
  ) {
    return 'Sequential policy active: first widen the frame with another stakeholder perspective, then keep closure suspended for one more turn.';
  }

  if (movePlan.secondaryMove) {
    return `Two-step policy active: ${movePlan.primaryMove} followed by ${movePlan.secondaryMove}.`;
  }

  return `Single-step policy active: ${movePlan.primaryMove}.`;
};

const buildDesignResponseMatrixRows = (
  snapshot: ReasoningAnalyticsSnapshot,
  analyses: ReasoningTurnAnalysis[]
): DesignResponseMatrixRow[] => {
  const analysisById = new Map(analyses.map(analysis => [analysis.messageId, analysis]));

  return snapshot.designResponseTraces
    .slice(-6)
    .reverse()
    .map(trace => {
      const sourceAnalysis = analysisById.get(trace.sourceMessageId);
      const responseAnalysis = analysisById.get(trace.responseMessageId);
      const cdoiDelta =
        sourceAnalysis && responseAnalysis
          ? Number((responseAnalysis.cdoi - sourceAnalysis.cdoi).toFixed(2))
          : null;

      return {
        sourceMessageId: trace.sourceMessageId,
        responseMessageId: trace.responseMessageId,
        identifiedState: sourceAnalysis?.dominantState || 'Pending',
        appliedMoveLabel: trace.appliedMoves.join(' -> '),
        moveSource: trace.moveSource,
        learnerFunction: trace.learnerFunction,
        resultingState: responseAnalysis?.dominantState || trace.resultingState || 'Review needed',
        transitionLabel: `${sourceAnalysis?.dominantState || 'Pending'} -> ${responseAnalysis?.dominantState || trace.resultingState || 'Review needed'}`,
        cdoiDelta,
      };
    });
};

const buildMoveEffectivenessSummary = (
  snapshot: ReasoningAnalyticsSnapshot,
  analyses: ReasoningTurnAnalysis[]
): MoveEffectivenessSummary[] => {
  const analysisById = new Map(analyses.map(analysis => [analysis.messageId, analysis]));
  const summaryByMove = new Map<string, { attempts: number; reflectiveShiftCount: number; cdoiDeltaTotal: number; cdoiDeltaCount: number }>();

  snapshot.designResponseTraces.forEach(trace => {
    const sourceAnalysis = analysisById.get(trace.sourceMessageId);
    const responseAnalysis = analysisById.get(trace.responseMessageId);
    const moveLabel = trace.appliedMoves.join(' -> ');
    const current = summaryByMove.get(moveLabel) || {
      attempts: 0,
      reflectiveShiftCount: 0,
      cdoiDeltaTotal: 0,
      cdoiDeltaCount: 0,
    };

    current.attempts += 1;
    if (responseAnalysis?.dominantState === ReasoningState.REFLECTIVE || responseAnalysis?.dominantState === ReasoningState.PERSPECTIVE) {
      current.reflectiveShiftCount += 1;
    }
    if (sourceAnalysis && responseAnalysis) {
      current.cdoiDeltaTotal += responseAnalysis.cdoi - sourceAnalysis.cdoi;
      current.cdoiDeltaCount += 1;
    }

    summaryByMove.set(moveLabel, current);
  });

  return [...summaryByMove.entries()]
    .map(([moveLabel, summary]) => ({
      moveLabel,
      attempts: summary.attempts,
      reflectiveShiftCount: summary.reflectiveShiftCount,
      cdoiLiftAverage:
        summary.cdoiDeltaCount > 0
          ? Number((summary.cdoiDeltaTotal / summary.cdoiDeltaCount).toFixed(2))
          : null,
    }))
    .sort((left, right) => right.attempts - left.attempts)
    .slice(0, 4);
};

const buildTeacherReviewQueue = (
  snapshot: ReasoningAnalyticsSnapshot,
  analyses: ReasoningTurnAnalysis[]
): TeacherReviewQueueItem[] =>
  analyses
    .filter(analysis =>
      analysis.sender === 'user' &&
      (
        analysis.requiresReview ||
        !!analysis.swarmTrace ||
        analysis.prematureConvergenceRisk > 0.58 ||
        analysis.surfaceComplianceRisk > 0.55
      )
    )
    .slice(-4)
    .reverse()
    .map(analysis => {
      const possibleSurfaceCompliance = analysis.surfaceComplianceRisk > 0.62;
      const convergenceRisk = analysis.prematureConvergenceRisk > 0.68;

      const priority: TeacherReviewQueueItem['priority'] =
        analysis.requiresReview || possibleSurfaceCompliance
          ? 'high'
          : analysis.swarmTrace || convergenceRisk
            ? 'medium'
            : 'watch';

      const title = analysis.requiresReview
        ? 'Low-confidence reasoning read'
        : possibleSurfaceCompliance
          ? 'Possible surface compliance'
          : analysis.swarmTrace
            ? 'Swarm-adjudicated turn'
            : 'Premature convergence watch';

      const summary = analysis.swarmTrace
        ? `${analysis.swarmTrace.triggerReason}. Final read: ${analysis.dominantState || 'Review'} / ${analysis.dominantStrategy || 'Review'}.`
        : `${analysis.dominantState || 'Review'} / ${analysis.dominantStrategy || 'Review'} with ${Math.round(analysis.confidence * 100)}% confidence, ${Math.round(analysis.prematureConvergenceRisk * 100)}% convergence risk, and ${Math.round(analysis.surfaceComplianceRisk * 100)}% surface-compliance risk.`;

      const recommendedAction = analysis.requiresReview
        ? 'Check whether the learner meaning was underspecified before trusting the adaptation path.'
        : possibleSurfaceCompliance
          ? 'Compare the learner wording with earlier turns to see whether reflection language outpaced actual integration.'
          : analysis.swarmTrace
            ? 'Inspect the swarm votes before deciding whether to override the current move.'
            : 'Monitor the next turn to confirm that closure-delay and counter-perspective support reopened exploration.';

      return {
        messageId: analysis.messageId,
        priority,
        title,
        summary,
        recommendedAction,
      };
    });

const buildTeacherVerificationItems = (
  snapshot: ReasoningAnalyticsSnapshot,
  analyses: ReasoningTurnAnalysis[]
): TeacherVerificationItem[] => {
  const analysisById = new Map(analyses.map(analysis => [analysis.messageId, analysis]));

  return snapshot.designResponseTraces
    .slice(-3)
    .reverse()
    .map(trace => {
      const sourceAnalysis = analysisById.get(trace.sourceMessageId);
      const responseAnalysis = analysisById.get(trace.responseMessageId);
      const cdoiDelta =
        sourceAnalysis && responseAnalysis
          ? responseAnalysis.cdoi - sourceAnalysis.cdoi
          : null;
      const cdoiSummary =
        cdoiDelta === null
          ? 'CDOI baseline unavailable'
          : cdoiDelta > 0.03
            ? `CDOI improved by ${Math.round(cdoiDelta * 100)}`
            : cdoiDelta < -0.03
              ? `CDOI dropped by ${Math.abs(Math.round(cdoiDelta * 100))}`
              : 'CDOI stayed roughly stable';

      return {
        sourceMessageId: trace.sourceMessageId,
        responseMessageId: trace.responseMessageId,
        identifiedState: sourceAnalysis?.dominantState || 'Pending',
        appliedMoveLabel: trace.appliedMoves.join(' -> '),
        moveSource: trace.moveSource,
        resultingState: responseAnalysis?.dominantState || trace.resultingState || 'Review needed',
        learnerFunction: trace.learnerFunction,
        verificationSummary: `${trace.moveSource === 'instructor_override' ? 'Instructor override' : 'Automatic adaptation'} led to a ${trace.learnerFunction} response after ${trace.appliedMoves.join(' -> ')}. ${cdoiSummary}.`,
      };
    });
};

export const createTeacherAnalyticsViewModel = (snapshot: ReasoningAnalyticsSnapshot): TeacherAnalyticsViewModel => {
  const latestLearnerAnalysis = [...snapshot.analyses].reverse().find(entry => entry.sender === 'user') || null;
  const learnerAnalyses = snapshot.analyses.filter(entry => entry.sender === 'user');
  const matrixRows = buildDesignResponseMatrixRows(snapshot, learnerAnalyses);
  const cdoiTrajectory = getCdoiTrajectorySummary(snapshot);
  const moveLabel = snapshot.currentMovePlan
    ? [snapshot.currentMovePlan.primaryMove, snapshot.currentMovePlan.secondaryMove].filter(Boolean).join(' -> ')
    : 'Pending move selection';

  return {
    statusTone: snapshot.regulatoryStatus,
    currentStateLabel: snapshot.currentLearnerState || 'Review needed',
    currentStrategyLabel: snapshot.currentLearnerStrategy || 'Awaiting signal',
    confidenceLabel: latestLearnerAnalysis ? `${Math.round(latestLearnerAnalysis.confidence * 100)}%` : '--',
    cdoiLabel: latestLearnerAnalysis ? `${Math.round(snapshot.latestCDOI * 100)}` : '--',
    cdoiTrajectoryLabel: cdoiTrajectory.label,
    cdoiTrajectorySummary: cdoiTrajectory.summary,
    entropyLabel: snapshot.transitionEntropy.toFixed(2),
    coherenceLabel: `${Math.round(snapshot.averageCoherence * 100)}%`,
    prematureConvergenceLabel: latestLearnerAnalysis ? `${Math.round(latestLearnerAnalysis.prematureConvergenceRisk * 100)}%` : '--',
    surfaceComplianceLabel: latestLearnerAnalysis ? `${Math.round(latestLearnerAnalysis.surfaceComplianceRisk * 100)}%` : '--',
    moveLabel,
    recentStateLabels: snapshot.stateSequence.slice(-4),
    interventionTitle: 'Recommended Instructor Move',
    interventionBody: snapshot.currentMovePlan
      ? `${snapshot.currentMovePlan.rationale} ${snapshot.currentMovePlan.instructionDirectives.join(' ')}`
      : `${snapshot.suggestedIntervention} ${snapshot.suggestedPrompt}`,
    cautionFlags: [...new Set([
      ...snapshot.cautionFlags,
      ...(latestLearnerAnalysis?.detectorFlags || []),
    ])],
    monitoringSummary: getTeacherMonitoringSummary(snapshot),
    sequencePolicySummary: getSequencePolicySummary(snapshot),
    latestSwarmTrace: latestLearnerAnalysis?.swarmTrace || null,
    reviewQueue: buildTeacherReviewQueue(snapshot, learnerAnalyses),
    verificationItems: buildTeacherVerificationItems(snapshot, learnerAnalyses),
    matrixRows,
    moveEffectiveness: buildMoveEffectivenessSummary(snapshot, learnerAnalyses),
  };
};

export const createLearnerCoachingViewModel = (snapshot: ReasoningAnalyticsSnapshot): LearnerCoachingViewModel => {
  const currentStateCopy = snapshot.currentLearnerState
    ? learnerStateCopy[snapshot.currentLearnerState]
    : {
        title: 'Your reasoning pattern is still being read.',
        summary: 'Keep explaining your thinking in your own words so the system can offer a more tailored nudge.',
      };

  return {
    coachingTitle: currentStateCopy.title,
    coachingSummary: currentStateCopy.summary,
    momentumLabel: getLearnerMomentum(snapshot),
    opennessLabel: `${Math.round(snapshot.latestCDOI * 100)} / 100 openness`,
    nextStepLabel: snapshot.currentMovePlan?.learnerFacingNudge || snapshot.suggestedPrompt,
    encouragement:
      snapshot.currentLearnerState === ReasoningState.REFLECTIVE
        ? 'You are doing the hard part now: holding multiple values together without rushing to closure.'
        : 'Progress here is not about being fast. It is about noticing what your first answer might be missing.',
    reflectionPrompts: getLearnerReflectionPrompts(snapshot),
  };
};
