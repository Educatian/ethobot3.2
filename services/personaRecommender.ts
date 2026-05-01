import {
  TriggerRule,
  ValuePriority,
  type Persona,
  type Scenario,
} from '../types';

// =============================================================================
// Rule 1 — single-stakeholder detector
// =============================================================================

const ROLE_KEYWORDS: Record<string, RegExp[]> = {
  teacher: [/\bteacher(s)?\b/i, /\bms\.?\s+rivera\b/i, /\binstructor\b/i, /선생님?/, /교사/],
  student: [/\bstudent(s)?\b/i, /\bjordan\b/i, /\bsam\b/i, /\bkid(s)?\b/i, /학생/, /아이/],
  parent: [
    /\bparent(s)?\b/i,
    /\bmr\.?\s+park\b/i,
    /\bms\.?\s+chen\b/i,
    /\bmom\b/i,
    /\bdad\b/i,
    /\bfather\b/i,
    /\bmother\b/i,
    /\bfamily\b/i,
    /부모/,
    /학부모/,
  ],
  administrator: [
    /\badministrator\b/i,
    /\bdr\.?\s+lee\b/i,
    /\bprincipal\b/i,
    /\bdistrict\b/i,
    /\bschool board\b/i,
    /행정/,
    /관리자/,
    /교육청/,
  ],
  it: [/\bit (coordinator|department|staff)\b/i, /\bmr\.?\s+diaz\b/i, /전산/, /it 부서/],
  vendor: [
    /\bedtech (company|vendor|rep)\b/i,
    /\balex\b/i,
    /\bcompany\b/i,
    /\bvendor\b/i,
    /\b3rd[- ]?party\b/i,
    /업체/,
    /벤더/,
    /제공사/,
  ],
};

const personaRoleBucket = (persona: Persona): keyof typeof ROLE_KEYWORDS => {
  const role = persona.role.toLowerCase();
  if (role.includes('teacher')) return 'teacher';
  if (role.includes('student')) return 'student';
  if (role.includes('parent')) return 'parent';
  if (role.includes('administrator')) return 'administrator';
  if (role.includes('it')) return 'it';
  return 'vendor';
};

export const detectStakeholderReferences = (
  text: string,
  scenario: Scenario
): Set<string> => {
  const referenced = new Set<string>();
  for (const persona of scenario.personas) {
    const namePattern = new RegExp(
      `\\b${persona.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i'
    );
    if (namePattern.test(text)) {
      referenced.add(persona.id);
      continue;
    }
    const bucket = personaRoleBucket(persona);
    const keywords = ROLE_KEYWORDS[bucket] ?? [];
    if (keywords.some(rx => rx.test(text))) {
      referenced.add(persona.id);
    }
  }
  return referenced;
};

// =============================================================================
// Rule 2 — single value-lens detector (ISTE-6 vocabulary)
// =============================================================================

const VALUE_VOCAB: Record<ValuePriority, RegExp[]> = {
  [ValuePriority.PRIVACY]: [
    /\bprivacy\b/i,
    /\bsurveillance\b/i,
    /\bdata (collect|sharing|protection|brokers?)\b/i,
    /\bconsent\b/i,
    /\bopt[- ]?(in|out)\b/i,
    /사생활/,
    /개인정보/,
    /동의/,
  ],
  [ValuePriority.SAFETY]: [
    /\bsafety\b/i,
    /\bsafe(ly)?\b/i,
    /\bharm\b/i,
    /\bsecurity\b/i,
    /\bprotect/i,
    /안전/,
    /보호/,
  ],
  [ValuePriority.AUTONOMY]: [
    /\bautonomy\b/i,
    /\bdignity\b/i,
    /\bagency\b/i,
    /\bfree(dom)?\b/i,
    /\bself[- ]?direct/i,
    /자율/,
    /존엄/,
  ],
  [ValuePriority.ACCOUNTABILITY]: [
    /\baccountab/i,
    /\bresponsib/i,
    /\boversight\b/i,
    /\baudit/i,
    /\bcomplian/i,
    /책임/,
    /감독/,
    /준수/,
  ],
  [ValuePriority.WELL_BEING]: [
    /\bwell[- ]?being\b/i,
    /\bsupport (every )?student/i,
    /\beffective/i,
    /\bsuccess\b/i,
    /\bengagement\b/i,
    /\blearning (gain|outcome)/i,
    /웰빙/,
    /지원/,
    /성과/,
  ],
  [ValuePriority.FAIRNESS]: [
    /\bfair(ness|ly)?\b/i,
    /\bequit/i,
    /\bbias(es|ed)?\b/i,
    /\bdiscriminat/i,
    /\bdisproportion/i,
    /형평/,
    /공정/,
    /편향/,
  ],
};

export const detectValueLenses = (text: string): Set<ValuePriority> => {
  const matched = new Set<ValuePriority>();
  for (const [value, regexes] of Object.entries(VALUE_VOCAB) as [ValuePriority, RegExp[]][]) {
    if (regexes.some(rx => rx.test(text))) matched.add(value);
  }
  return matched;
};

// =============================================================================
// Rule 3 — conditional reasoning / evidence detector
// =============================================================================

const CONDITIONAL_PATTERNS: RegExp[] = [
  /\bif\b[^.?!]*\bthen\b/i,
  /\bdepending on\b/i,
  /\bonly if\b/i,
  /\bunless\b/i,
  /\bprovided (that|it)\b/i,
  /\bso long as\b/i,
  /\bas long as\b/i,
  /\bwhen[^.?!]{0,40}\bthen\b/i,
  /만약[^.?!]*라면/,
  /따라(서|선|는)/,
];

const EVIDENCE_PATTERNS: RegExp[] = [
  /\bfor example\b/i,
  /\bfor instance\b/i,
  /\baccording to\b/i,
  /\bstud(?:y|ies) (?:show|find|suggest)/i,
  /\bresearch (?:shows|finds|suggests)\b/i,
  /\bdata (?:shows|suggests)\b/i,
  /\b(in|the) case (?:of|where)\b/i,
  /예를 들어/,
  /사례/,
  /연구에 따르면/,
];

export const detectConditionalOrEvidence = (text: string) => ({
  hasConditional: CONDITIONAL_PATTERNS.some(rx => rx.test(text)),
  hasEvidence: EVIDENCE_PATTERNS.some(rx => rx.test(text)),
});

// =============================================================================
// Recommendation evaluator
// =============================================================================

export interface RecommenderInput {
  scenario: Scenario;
  recentLearnerTurns: string[]; // most recent first OR last — we just join
  calledPersonaIds: string[];
}

export interface PersonaRecommendationResult {
  personaId: string;
  triggerRule: TriggerRule;
  rationale: string;
  matchedSignals: string[];
}

const pickUncalledPersona = (
  scenario: Scenario,
  calledPersonaIds: string[],
  preferRoleNotIn?: Set<string>,
  preferPrimaryValueNotIn?: Set<ValuePriority>
): Persona | null => {
  const uncalled = scenario.personas.filter(p => !calledPersonaIds.includes(p.id));
  if (uncalled.length === 0) return null;

  if (preferRoleNotIn && preferRoleNotIn.size > 0) {
    const candidate = uncalled.find(p => !preferRoleNotIn.has(p.id));
    if (candidate) return candidate;
  }
  if (preferPrimaryValueNotIn && preferPrimaryValueNotIn.size > 0) {
    const candidate = uncalled.find(p => !preferPrimaryValueNotIn.has(p.primaryValue));
    if (candidate) return candidate;
  }
  return uncalled[0];
};

// Names of stakeholder buckets that have been referenced — used to surface the
// dominant frame in Rule 1 rationale (e.g., "you've been reasoning mostly from
// the teacher's side").
const dominantBucket = (refs: Set<string>, scenario: Scenario): string | null => {
  if (refs.size === 0) return null;
  const persona = scenario.personas.find(p => refs.has(p.id));
  return persona ? persona.role.toLowerCase() : null;
};

const valueLensLabel: Record<ValuePriority, string> = {
  [ValuePriority.PRIVACY]: 'privacy',
  [ValuePriority.SAFETY]: 'safety',
  [ValuePriority.AUTONOMY]: 'autonomy',
  [ValuePriority.ACCOUNTABILITY]: 'accountability',
  [ValuePriority.WELL_BEING]: 'well-being',
  [ValuePriority.FAIRNESS]: 'fairness',
};

const rationaleForRule1 = (persona: Persona, dominantRole: string | null): string => {
  if (dominantRole) {
    return `You've been reasoning mostly from the ${dominantRole}'s side so far. I'd like to bring in ${persona.name} (${persona.role}) — a perspective you haven't heard yet.`;
  }
  return `Let's widen the field of view. ${persona.name} (${persona.role}) can add a perspective you haven't heard yet.`;
};

const rationaleForRule2 = (persona: Persona, dominantValue: ValuePriority | null): string => {
  if (dominantValue) {
    return `Your reasoning has been weighed mostly through ${valueLensLabel[dominantValue]} so far. ${persona.name} (${persona.role}) holds a different value lens — I'd like to bring them in.`;
  }
  return `One value lens has been doing most of the work in your reasoning. ${persona.name} (${persona.role}) weights things differently.`;
};

const rationaleForRule3 = (persona: Persona): string =>
  `There's another voice here that might be helpful — ${persona.name} (${persona.role}) has a specific concern about how this decision was made.`;

export const evaluateRecommendation = (
  input: RecommenderInput
): PersonaRecommendationResult | null => {
  const { scenario, recentLearnerTurns, calledPersonaIds } = input;
  const corpus = recentLearnerTurns.join(' \n ');
  if (!corpus.trim()) return null;
  const uncalled = scenario.personas.filter(p => !calledPersonaIds.includes(p.id));
  if (uncalled.length === 0) return null;

  // Rule 1
  const stakeholderRefs = detectStakeholderReferences(corpus, scenario);
  if (stakeholderRefs.size <= 1) {
    const candidate = pickUncalledPersona(scenario, calledPersonaIds, stakeholderRefs);
    if (candidate) {
      const dominantRole = dominantBucket(stakeholderRefs, scenario);
      return {
        personaId: candidate.id,
        triggerRule: TriggerRule.RULE_1_SINGLE_STAKEHOLDER,
        rationale: rationaleForRule1(candidate, dominantRole),
        matchedSignals: [`stakeholder_count: ${stakeholderRefs.size}`],
      };
    }
  }

  // Rule 2
  const valueLenses = detectValueLenses(corpus);
  if (valueLenses.size <= 1) {
    const candidate = pickUncalledPersona(scenario, calledPersonaIds, undefined, valueLenses);
    if (candidate) {
      const dominantValue = valueLenses.size === 1 ? Array.from(valueLenses)[0] : null;
      return {
        personaId: candidate.id,
        triggerRule: TriggerRule.RULE_2_SINGLE_VALUE_LENS,
        rationale: rationaleForRule2(candidate, dominantValue),
        matchedSignals: [
          `value_lenses: ${Array.from(valueLenses).join(',') || '∅'}`,
        ],
      };
    }
  }

  // Rule 3
  const { hasConditional, hasEvidence } = detectConditionalOrEvidence(corpus);
  if (!hasConditional && !hasEvidence) {
    const candidate = pickUncalledPersona(scenario, calledPersonaIds);
    if (candidate) {
      return {
        personaId: candidate.id,
        triggerRule: TriggerRule.RULE_3_NO_CONDITIONS_OR_EVIDENCE,
        rationale: rationaleForRule3(candidate),
        matchedSignals: [
          `conditional: ${hasConditional}`,
          `evidence: ${hasEvidence}`,
        ],
      };
    }
  }

  return null;
};

// =============================================================================
// Trigger gating
// =============================================================================

export interface GateState {
  facilitatorTurnNumber: number;
  lastRecommendationTurn: number | null;
}

export const isRecommendationGateOpen = (state: GateState): boolean => {
  if (state.facilitatorTurnNumber < 4) return false;
  if (state.lastRecommendationTurn === null) return true;
  return state.facilitatorTurnNumber - state.lastRecommendationTurn >= 2;
};
