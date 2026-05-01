// Pure data — vocabulary, prototypes, ordering. Extracted from
// reasoningAnalyticsService.ts so the analytics module stays focused on
// pipeline logic. No runtime state lives here.

import {
  DiscourseStrategy,
  ReasoningState,
  type StateProbabilityMap,
  type StrategyProbabilityMap,
} from '../../types';

// ── Provider / runtime constants ──────────────────────────────────────────
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const SWARM_MODEL = 'gemini-2.0-flash';
export const REASONING_DATASET_SCHEMA_VERSION = 'reasoning-dataset/v0.5';
export const EMBEDDING_TIMEOUT_MS = 2500;
export const SWARM_CALL_TIMEOUT_MS = 1800;
export const SWARM_TOTAL_TIMEOUT_MS = 3600;
export const MAX_TEXT_EMBEDDING_CACHE_ENTRIES = 48;
export const PROVIDER_FAILURE_THRESHOLD = 3;
export const PROVIDER_COOLDOWN_MS = 120000;
export const REVIEWED_CALIBRATION_MIN_SIMILARITY = 0.16;
export const MIN_REVIEWED_CORPUS_PROVIDER_POOL = 4;
export const MIN_REVIEWED_CORPUS_PROVIDER_MATCHES = 2;
export const REVIEWED_CORPUS_PROVIDER_LABEL = 'reviewed-corpus-vnext@0.1.0';
export const REVIEWED_PROFILE_MIN_REVIEWED_COUNT = 6;
export const REVIEWED_PROFILE_MIN_LABEL_SUPPORT = 2;
export const REVIEWED_PROFILE_PROVIDER_LABEL = 'reviewed-profile-vnext@0.2.0';
export const REVIEWED_PROFILE_MERGED_PROVIDER_LABEL = 'reviewed-profile-merged@0.2.0';

// ── Enum ordering ─────────────────────────────────────────────────────────
export const STATE_ORDER = [
  ReasoningState.DEONTIC,
  ReasoningState.CONSEQUENTIALIST,
  ReasoningState.PERSPECTIVE,
  ReasoningState.REFLECTIVE,
];

export const STRATEGY_ORDER = [
  DiscourseStrategy.SELF_EVALUATION,
  DiscourseStrategy.QUESTIONING,
  DiscourseStrategy.JUSTIFICATION,
  DiscourseStrategy.ASSERTION,
  DiscourseStrategy.INFORMATION_SEEKING,
  DiscourseStrategy.EMPATHY,
];

// ── Term banks for heuristic detection ────────────────────────────────────
export const ETHICAL_TERMS = [
  'ethic', 'ethical', 'moral', 'fair', 'bias', 'privacy', 'consent', 'accountability', 'justice', 'harm',
  'responsibility', 'rights', 'value', 'dignity', 'surveillance',
  '윤리', '도덕', '공정', '편향', '사생활', '동의', '책임', '정의', '피해', '권리', '가치', '존엄', '감시',
];

export const CLOSURE_TERMS = [
  'final answer', 'the answer is', 'we should just', 'obviously', 'simply', 'there is no need', 'conclusion',
  'i choose', 'the best option', 'it is clear', '결론', '답은', '그냥', '당연히', '선택하', '정답', '결론적으로', '분명히',
];

export const REFLECTIVE_LANGUAGE_TERMS = [
  'i realize', 'i may be missing', 'i might be wrong', 'on the other hand', 'at the same time', 'i need to reconsider',
  'i overlooked', 'if i step back', 'maybe my first answer', 'ê°€ì •í•´ë³´ë©´', 'ë‹¤ì‹œ ìƒê°', 'ì„±ì°°', 'ë°˜ì„±', 'ë†“ì¹œ', 'ìž˜ëª» ë³¸',
];

// ── State / strategy lexicons ─────────────────────────────────────────────
export const STATE_LEXICONS: Record<ReasoningState, { weight: number; patterns: string[] }> = {
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

export const STRATEGY_LEXICONS: Record<DiscourseStrategy, { weight: number; patterns: string[] }> = {
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

// ── State / strategy prototypes (for embedding similarity) ────────────────
export const STATE_PROTOTYPES: Record<ReasoningState, string[]> = {
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

export const STRATEGY_PROTOTYPES: Record<DiscourseStrategy, string[]> = {
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

// ── Empty probability builders ────────────────────────────────────────────
export const EMPTY_STATE_MAP = (): StateProbabilityMap => ({
  [ReasoningState.DEONTIC]: 0,
  [ReasoningState.CONSEQUENTIALIST]: 0,
  [ReasoningState.PERSPECTIVE]: 0,
  [ReasoningState.REFLECTIVE]: 0,
});

export const EMPTY_STRATEGY_MAP = (): StrategyProbabilityMap => ({
  [DiscourseStrategy.SELF_EVALUATION]: 0,
  [DiscourseStrategy.QUESTIONING]: 0,
  [DiscourseStrategy.JUSTIFICATION]: 0,
  [DiscourseStrategy.ASSERTION]: 0,
  [DiscourseStrategy.INFORMATION_SEEKING]: 0,
  [DiscourseStrategy.EMPATHY]: 0,
});

// ── Learner-facing copy ───────────────────────────────────────────────────
export const learnerStateCopy: Record<ReasoningState, { title: string; summary: string }> = {
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
