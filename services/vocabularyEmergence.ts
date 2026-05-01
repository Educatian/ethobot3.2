import type { VocabularyEmergence } from '../types';

export interface VocabularyTerm {
  key: string;
  category:
    | 'consent'
    | 'dignity'
    | 'surveillance'
    | 'chilling_effect'
    | 'conditional_reasoning'
    | 'data_minimization'
    | 'equity'
    | 'bias';
  matchers: RegExp[];
}

export const DEFAULT_VOCABULARY_TERMS: VocabularyTerm[] = [
  {
    key: 'consent',
    category: 'consent',
    matchers: [/\bconsent\b/i, /\bopt[- ]?(in|out)\b/i, /동의/, /허락/, /고지/],
  },
  {
    key: 'dignity',
    category: 'dignity',
    matchers: [/\bdignity\b/i, /존엄/, /자존감/],
  },
  {
    key: 'surveillance',
    category: 'surveillance',
    matchers: [/\bsurveillance\b/i, /\bbeing watched\b/i, /감시/, /지켜보(고|는)/],
  },
  {
    key: 'chilling_effect',
    category: 'chilling_effect',
    matchers: [
      /\bchilling effect\b/i,
      /\bself[- ]?censor/i,
      /\bhold(?:ing)? back\b/i,
      /위축/,
      /눈치/,
    ],
  },
  {
    key: 'conditional_reasoning',
    category: 'conditional_reasoning',
    matchers: [
      /\bif\b[^.?!]*\bthen\b/i,
      /\bdepending on\b/i,
      /\bonly if\b/i,
      /\bunless\b/i,
      /\bprovided that\b/i,
      /만약[^\.\?!]*라면/,
      /따라(서|선|는)/,
      /...에 따라/,
    ],
  },
  {
    key: 'data_minimization',
    category: 'data_minimization',
    matchers: [
      /\bdata minimization\b/i,
      /\bleast (amount|invasive)\b/i,
      /\bde[- ]?identifi/i,
      /최소한의 데이터/,
      /비식별/,
    ],
  },
  {
    key: 'equity',
    category: 'equity',
    matchers: [/\bequity\b/i, /\bdisproportion/i, /형평/, /불균형/],
  },
  {
    key: 'bias',
    category: 'bias',
    matchers: [/\bbias(?:ed|es)?\b/i, /편향/, /편견/],
  },
];

export interface VocabularyState {
  emergedKeys: Set<string>;
  emergences: VocabularyEmergence[];
}

export const createEmptyVocabularyState = (): VocabularyState => ({
  emergedKeys: new Set<string>(),
  emergences: [],
});

export interface DetectVocabularyArgs {
  text: string;
  turnNumber: number;
  recentlyExitedPersonaId?: string;
  state: VocabularyState;
  terms?: VocabularyTerm[];
}

export interface DetectVocabularyResult {
  state: VocabularyState;
  newlyEmerged: VocabularyEmergence[];
}

export const detectVocabulary = ({
  text,
  turnNumber,
  recentlyExitedPersonaId,
  state,
  terms = DEFAULT_VOCABULARY_TERMS,
}: DetectVocabularyArgs): DetectVocabularyResult => {
  const newlyEmerged: VocabularyEmergence[] = [];
  const emergedKeys = new Set(state.emergedKeys);

  for (const term of terms) {
    if (emergedKeys.has(term.key)) continue;
    const matched = term.matchers.some(rx => rx.test(text));
    if (!matched) continue;

    const emergence: VocabularyEmergence = {
      term: term.key,
      firstTurn: turnNumber,
      personaJustExited: recentlyExitedPersonaId,
      emergedAt: new Date().toISOString(),
    };
    newlyEmerged.push(emergence);
    emergedKeys.add(term.key);
  }

  if (newlyEmerged.length === 0) {
    return { state, newlyEmerged };
  }

  return {
    state: {
      emergedKeys,
      emergences: [...state.emergences, ...newlyEmerged],
    },
    newlyEmerged,
  };
};
