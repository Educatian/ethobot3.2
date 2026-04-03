

export interface User {
  name: string;
  course: string;
  email?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
}

export enum ReasoningState {
  DEONTIC = 'Deontic',
  CONSEQUENTIALIST = 'Consequentialist',
  PERSPECTIVE = 'Perspective-taking',
  REFLECTIVE = 'Reflective',
}

export enum DiscourseStrategy {
  SELF_EVALUATION = 'Self-Evaluation',
  QUESTIONING = 'Questioning',
  JUSTIFICATION = 'Justification',
  ASSERTION = 'Assertion',
  INFORMATION_SEEKING = 'Information Seeking',
  EMPATHY = 'Empathy',
}

export enum LearnerDiscourseFunction {
  EXPLORATORY = 'Exploratory',
  DELIBERATIVE = 'Deliberative',
  CLOSURE = 'Closure',
  NEUTRAL = 'Neutral',
}

export enum PedagogicalMove {
  GENERAL_GUIDANCE = 'General Guidance',
  COUNTER_PERSPECTIVE = 'Counter-Perspective',
  JUSTIFICATION_REQUEST = 'Justification Request',
  VALUE_PROBE = 'Value Probe',
  CLOSURE_DELAY = 'Closure Delay',
  TRADEOFF_EXPLORATION = 'Trade-off Exploration',
  SELF_EVALUATION_PROMPT = 'Self-Evaluation Prompt',
}

export type StateProbabilityMap = Record<ReasoningState, number>;
export type StrategyProbabilityMap = Record<DiscourseStrategy, number>;
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'fallback' | 'offline';

export interface ReasoningSignal {
  label: string;
  score: number;
  matchedTerms: string[];
  summary: string;
}

export interface ProviderHealthSnapshot {
  status: ProviderHealthStatus;
  consecutiveFailures: number;
  cooldownRemainingMs: number;
  lastError: string | null;
}

export interface RuntimeStabilitySnapshot {
  embedding: ProviderHealthSnapshot;
  swarm: ProviderHealthSnapshot;
}

export interface SwarmJudgeVote {
  judgeId: string;
  focus: 'state' | 'strategy' | 'move';
  predictedState?: ReasoningState | null;
  predictedStrategy?: DiscourseStrategy | null;
  predictedMove?: PedagogicalMove | null;
  confidence: number;
  rationale: string;
}

export interface SwarmAdjudicationTrace {
  triggerReason: string;
  judgeVotes: SwarmJudgeVote[];
  arbiterState: ReasoningState | null;
  arbiterStrategy: DiscourseStrategy | null;
  arbiterMove: PedagogicalMove | null;
  arbiterConfidence: number;
  summary: string;
}

export interface ReasoningTurnAnalysis {
  messageId: string;
  sender: 'user' | 'bot';
  providerLabel: string;
  dominantState: ReasoningState | null;
  stateProbabilities: StateProbabilityMap;
  dominantStrategy: DiscourseStrategy | null;
  strategyProbabilities: StrategyProbabilityMap;
  confidence: number;
  uncertainty: number;
  coherence: number;
  stateEntropy: number;
  ethicalDensity: number;
  semanticNovelty: number;
  productiveProbability: number;
  closureProbability: number;
  prematureConvergenceRisk: number;
  surfaceComplianceRisk: number;
  cdoi: number;
  discourseFunction: LearnerDiscourseFunction;
  explanation: string[];
  matchedSignals: string[];
  signals: ReasoningSignal[];
  detectorFlags: string[];
  requiresReview: boolean;
  swarmTrace?: SwarmAdjudicationTrace | null;
}

export interface ReasoningClassifierContext {
  message: Message;
  priorMessages: Message[];
  priorAnalyses: ReasoningTurnAnalysis[];
}

export interface ReasoningClassifierProvider {
  id: string;
  version: string;
  kind: 'heuristic' | 'embedding' | 'llm' | 'hybrid';
  description: string;
  classifyTurn: (context: ReasoningClassifierContext) => Promise<ReasoningTurnAnalysis>;
}

export type RegulatoryStatus = 'balanced' | 'stagnation' | 'fragmentation' | 'review';

export interface PedagogicalMovePlan {
  selectedAtMessageId: string;
  source: 'automatic' | 'instructor_override';
  primaryMove: PedagogicalMove;
  secondaryMove?: PedagogicalMove;
  rationale: string;
  instructionDirectives: string[];
  learnerFacingNudge: string;
}

export interface DesignResponseTrace {
  sourceMessageId: string;
  responseMessageId: string;
  appliedMoves: PedagogicalMove[];
  moveSource: 'automatic' | 'instructor_override';
  learnerFunction: LearnerDiscourseFunction;
  resultingState: ReasoningState | null;
  resultingCDOI: number;
}

export interface ReasoningAnalyticsSnapshot {
  analyses: ReasoningTurnAnalysis[];
  currentLearnerState: ReasoningState | null;
  currentLearnerStrategy: DiscourseStrategy | null;
  transitionCounts: Partial<Record<ReasoningState, Partial<Record<ReasoningState, number>>>>;
  stateSequence: ReasoningState[];
  transitionEntropy: number;
  averageCoherence: number;
  regulatoryStatus: RegulatoryStatus;
  suggestedIntervention: string;
  suggestedPrompt: string;
  cautionFlags: string[];
  currentMovePlan: PedagogicalMovePlan | null;
  latestCDOI: number;
  cdoiHistory: number[];
  designResponseTraces: DesignResponseTrace[];
  provider: string;
  runtimeStability: RuntimeStabilitySnapshot;
}

export interface TeacherReviewQueueItem {
  messageId: string;
  priority: 'high' | 'medium' | 'watch';
  title: string;
  summary: string;
  recommendedAction: string;
}

export interface HumanReasoningAnnotation {
  messageId: string;
  annotatedState: ReasoningState | null;
  annotatedStrategy: DiscourseStrategy | null;
  annotatedMove: PedagogicalMove | null;
  reviewDecision: 'confirmed_ai' | 'adjusted';
  reviewerNotes: string;
  reviewedAt: string;
}

export interface ReviewedCalibrationCorpusEntry {
  messageId: string;
  text: string;
  annotatedState: ReasoningState | null;
  annotatedStrategy: DiscourseStrategy | null;
  annotatedMove: PedagogicalMove | null;
  reviewDecision: 'confirmed_ai' | 'adjusted';
  reviewedAt: string;
}

export interface ReviewedCalibrationProfile {
  schemaVersion: string;
  providerLabel: string;
  generatedAt: string;
  reviewedCount: number;
  adjustedCount: number;
  stateSupport: Partial<Record<ReasoningState, number>>;
  strategySupport: Partial<Record<DiscourseStrategy, number>>;
  stateTermWeights: Partial<Record<ReasoningState, Record<string, number>>>;
  strategyTermWeights: Partial<Record<DiscourseStrategy, Record<string, number>>>;
}

export interface TeacherVerificationItem {
  sourceMessageId: string;
  responseMessageId: string;
  identifiedState: string;
  appliedMoveLabel: string;
  moveSource: 'automatic' | 'instructor_override';
  resultingState: string;
  learnerFunction: LearnerDiscourseFunction;
  verificationSummary: string;
}

export interface DesignResponseMatrixRow {
  sourceMessageId: string;
  responseMessageId: string;
  identifiedState: string;
  appliedMoveLabel: string;
  moveSource: 'automatic' | 'instructor_override';
  learnerFunction: LearnerDiscourseFunction;
  resultingState: string;
  transitionLabel: string;
  cdoiDelta: number | null;
}

export interface MoveEffectivenessSummary {
  moveLabel: string;
  attempts: number;
  reflectiveShiftCount: number;
  cdoiLiftAverage: number | null;
}

export interface RecalibrationAgreementMetric {
  label: string;
  agreed: number;
  total: number;
  rate: number | null;
}

export interface RecalibrationHotspot {
  fromLabel: string;
  toLabel: string;
  count: number;
}

export interface RecalibrationRiskSlice {
  label: string;
  reviewedCount: number;
  stateAgreementRate: number | null;
}

export interface ProviderPerformanceSlice {
  providerLabel: string;
  reviewedCount: number;
  stateAgreementRate: number | null;
  adjustmentRate: number | null;
}

export interface RecalibrationReport {
  reviewedCount: number;
  adjustedCount: number;
  adjustmentRate: number;
  stateAgreement: RecalibrationAgreementMetric;
  strategyAgreement: RecalibrationAgreementMetric;
  moveAgreement: RecalibrationAgreementMetric;
  stateHotspots: RecalibrationHotspot[];
  strategyHotspots: RecalibrationHotspot[];
  moveHotspots: RecalibrationHotspot[];
  riskSlices: RecalibrationRiskSlice[];
  providerSlices: ProviderPerformanceSlice[];
}

export interface ShadowProviderComparisonSlice {
  label: string;
  providerLabel: string;
  reviewedCount: number;
  stateAgreementRate: number | null;
  strategyAgreementRate: number | null;
  stateDeltaVsCurrent: number | null;
  strategyDeltaVsCurrent: number | null;
}

export interface ShadowProviderComparisonReport {
  reviewedCount: number;
  currentStateAgreementRate: number | null;
  currentStrategyAgreementRate: number | null;
  slices: ShadowProviderComparisonSlice[];
}

export interface TeacherAnalyticsViewModel {
  statusTone: string;
  currentStateLabel: string;
  currentStrategyLabel: string;
  confidenceLabel: string;
  cdoiLabel: string;
  cdoiTrajectoryLabel: string;
  cdoiTrajectorySummary: string;
  entropyLabel: string;
  coherenceLabel: string;
  prematureConvergenceLabel: string;
  surfaceComplianceLabel: string;
  moveLabel: string;
  recentStateLabels: string[];
  interventionTitle: string;
  interventionBody: string;
  cautionFlags: string[];
  monitoringSummary: string;
  sequencePolicySummary: string;
  latestSwarmTrace: SwarmAdjudicationTrace | null;
  reviewQueue: TeacherReviewQueueItem[];
  verificationItems: TeacherVerificationItem[];
  matrixRows: DesignResponseMatrixRow[];
  moveEffectiveness: MoveEffectivenessSummary[];
}

export interface LearnerCoachingViewModel {
  coachingTitle: string;
  coachingSummary: string;
  momentumLabel: string;
  opennessLabel: string;
  nextStepLabel: string;
  encouragement: string;
  reflectionPrompts: string[];
}

export interface ReasoningDatasetExample {
  id: string;
  schemaVersion: string;
  provider: string;
  createdAt: string;
  messageId: string;
  speaker: 'user' | 'bot';
  text: string;
  contextWindow: string[];
  predictedState: ReasoningState | null;
  predictedStrategy: DiscourseStrategy | null;
  confidence: number;
  uncertainty: number;
  coherence: number;
  discourseFunction: LearnerDiscourseFunction;
  cdoi: number;
  ethicalDensity: number;
  semanticNovelty: number;
  productiveProbability: number;
  closureProbability: number;
  prematureConvergenceRisk: number;
  surfaceComplianceRisk: number;
  requiresReview: boolean;
  explanation: string[];
  signals: ReasoningSignal[];
  recommendedMoves: PedagogicalMove[];
  humanAnnotation?: HumanReasoningAnnotation;
}

export enum ProblemStage {
  PROBLEM_DEFINITION = 'Problem Definition',
  SOLUTION_EXPLORATION = 'Solution Exploration',
  IMPLEMENTATION = 'Implementation',
  REFLECTION = 'Reflection',
}

export enum ChallengeType {
  DILEMMA = 'Ethical Dilemma',
  PERSPECTIVE = 'Perspective Taking',
  MYSTERY = 'Case Study Mystery',
  POLL = 'Ethics Poll',
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  options: { text: string; feedback?: string }[];
}

export interface KnowledgeSource {
  id: string;
  title: string;
  summary: string;
  url: string;
  youtubeUrl?: string;
  blogUrl?: string;
}

export enum LogEventType {
  SESSION_START = 'SESSION_START',
  MESSAGE_EXCHANGE = 'MESSAGE_EXCHANGE',
  CHOICE_SELECTED = 'CHOICE_SELECTED',
  ELEMENT_CLICK = 'ELEMENT_CLICK',
}

export interface LogEvent {
  type: LogEventType;
  timestamp: string;
  details: any;
}

export interface SessionLog {
  studentInfo: User;
  events: LogEvent[];
}
