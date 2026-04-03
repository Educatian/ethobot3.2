import type {
  HumanReasoningAnnotation,
  Message,
  RecalibrationAgreementMetric,
  RecalibrationHotspot,
  ProviderPerformanceSlice,
  RecalibrationReport,
  RecalibrationRiskSlice,
  ReasoningAnalyticsSnapshot,
  ReasoningDatasetExample,
  ReviewedCalibrationProfile,
  ShadowProviderComparisonReport,
  ShadowProviderComparisonSlice,
  User,
} from '../types';
import {
  predictWithReviewedCalibrationProfile,
  REASONING_DATASET_SCHEMA_VERSION,
} from './reasoningAnalyticsService';

const getContextWindow = (messages: Message[], index: number, span: number) =>
  messages
    .slice(Math.max(0, index - span), index)
    .map(message => `${message.sender}: ${message.text}`);

const getRecommendedMoveMap = (analytics: ReasoningAnalyticsSnapshot) => {
  const moveMap = new Map<string, string[]>();

  analytics.designResponseTraces.forEach(trace => {
    moveMap.set(trace.sourceMessageId, trace.appliedMoves);
  });

  if (analytics.currentMovePlan) {
    moveMap.set(analytics.currentMovePlan.selectedAtMessageId, [
      analytics.currentMovePlan.primaryMove,
      ...(analytics.currentMovePlan.secondaryMove ? [analytics.currentMovePlan.secondaryMove] : []),
    ]);
  }

  return moveMap;
};

export const buildReasoningDatasetExamples = (
  messages: Message[],
  analytics: ReasoningAnalyticsSnapshot,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {},
  options: { reviewedOnly?: boolean } = {}
): ReasoningDatasetExample[] => {
  const learnerAnalyses = analytics.analyses.filter(entry => entry.sender === 'user');
  const analysisById = new Map(learnerAnalyses.map(analysis => [analysis.messageId, analysis]));
  const recommendedMoveMap = getRecommendedMoveMap(analytics);

  return messages
    .filter(message => message.sender === 'user')
    .map((message, index) => {
      const analysis = analysisById.get(message.id);
      if (!analysis) {
        return null;
      }

      return {
        id: `reasoning-example-${message.id}`,
        schemaVersion: REASONING_DATASET_SCHEMA_VERSION,
        provider: analysis.providerLabel,
        createdAt: new Date().toISOString(),
        messageId: message.id,
        speaker: message.sender,
        text: message.text,
        contextWindow: getContextWindow(messages, messages.findIndex(entry => entry.id === message.id), 3),
        predictedState: analysis.dominantState,
        predictedStrategy: analysis.dominantStrategy,
        confidence: analysis.confidence,
        uncertainty: analysis.uncertainty,
        coherence: analysis.coherence,
        discourseFunction: analysis.discourseFunction,
        cdoi: analysis.cdoi,
        ethicalDensity: analysis.ethicalDensity,
        semanticNovelty: analysis.semanticNovelty,
        productiveProbability: analysis.productiveProbability,
        closureProbability: analysis.closureProbability,
        prematureConvergenceRisk: analysis.prematureConvergenceRisk,
        surfaceComplianceRisk: analysis.surfaceComplianceRisk,
        requiresReview: analysis.requiresReview,
        explanation: analysis.explanation,
        signals: analysis.signals,
        recommendedMoves: recommendedMoveMap.get(analysis.messageId) || [],
        humanAnnotation: annotationsByMessageId[analysis.messageId],
      } satisfies ReasoningDatasetExample;
    })
    .filter((entry): entry is ReasoningDatasetExample => entry !== null)
    .filter(example => !options.reviewedOnly || !!example.humanAnnotation);
};

const buildAgreementMetric = <T>(
  label: string,
  examples: ReasoningDatasetExample[],
  predictedSelector: (example: ReasoningDatasetExample) => T | null | undefined,
  annotatedSelector: (example: ReasoningDatasetExample) => T | null | undefined
): RecalibrationAgreementMetric => {
  const scoped = examples.filter(example => annotatedSelector(example) !== null && annotatedSelector(example) !== undefined);
  const agreed = scoped.filter(example => predictedSelector(example) === annotatedSelector(example)).length;

  return {
    label,
    agreed,
    total: scoped.length,
    rate: scoped.length > 0 ? Number((agreed / scoped.length).toFixed(2)) : null,
  };
};

const buildHotspots = <T>(
  examples: ReasoningDatasetExample[],
  predictedSelector: (example: ReasoningDatasetExample) => T | null | undefined,
  annotatedSelector: (example: ReasoningDatasetExample) => T | null | undefined
): RecalibrationHotspot[] => {
  const counts = new Map<string, number>();

  examples.forEach(example => {
    const predicted = predictedSelector(example);
    const annotated = annotatedSelector(example);
    if (annotated == null || predicted == null || predicted === annotated) {
      return;
    }

    const key = `${String(predicted)}|||${String(annotated)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([key, count]) => {
      const [fromLabel, toLabel] = key.split('|||');
      return { fromLabel, toLabel, count };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
};

const buildRiskSlice = (
  label: string,
  examples: ReasoningDatasetExample[],
  predicate: (example: ReasoningDatasetExample) => boolean
): RecalibrationRiskSlice => {
  const scoped = examples.filter(predicate);
  const metric = buildAgreementMetric(label, scoped, example => example.predictedState, example => example.humanAnnotation?.annotatedState);

  return {
    label,
    reviewedCount: scoped.length,
    stateAgreementRate: metric.rate,
  };
};

const buildProviderSlices = (examples: ReasoningDatasetExample[]): ProviderPerformanceSlice[] => {
  const buckets = new Map<string, ReasoningDatasetExample[]>();

  examples.forEach(example => {
    const bucket = buckets.get(example.provider) || [];
    bucket.push(example);
    buckets.set(example.provider, bucket);
  });

  return [...buckets.entries()]
    .map(([providerLabel, providerExamples]) => {
      const stateAgreement = buildAgreementMetric(
        providerLabel,
        providerExamples,
        example => example.predictedState,
        example => example.humanAnnotation?.annotatedState
      );
      const adjustedCount = providerExamples.filter(example => example.humanAnnotation?.reviewDecision === 'adjusted').length;

      return {
        providerLabel,
        reviewedCount: providerExamples.length,
        stateAgreementRate: stateAgreement.rate,
        adjustmentRate: providerExamples.length > 0 ? Number((adjustedCount / providerExamples.length).toFixed(2)) : null,
      };
    })
    .sort((left, right) => right.reviewedCount - left.reviewedCount);
};

const toDelta = (candidate: number | null, baseline: number | null) =>
  candidate !== null && baseline !== null ? Number((candidate - baseline).toFixed(2)) : null;

const buildShadowAgreementRate = <T>(
  examples: ReasoningDatasetExample[],
  predictedSelector: (example: ReasoningDatasetExample) => T | null | undefined,
  annotatedSelector: (example: ReasoningDatasetExample) => T | null | undefined
) => buildAgreementMetric('shadow agreement', examples, predictedSelector, annotatedSelector).rate;

export const buildShadowProviderComparisonReport = (
  messages: Message[],
  analytics: ReasoningAnalyticsSnapshot,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {},
  profiles: Array<{ label: string; profile: ReviewedCalibrationProfile | null }>
): ShadowProviderComparisonReport => {
  const reviewedExamples = buildReasoningDatasetExamples(messages, analytics, annotationsByMessageId, { reviewedOnly: true });
  const currentStateAgreementRate = buildShadowAgreementRate(
    reviewedExamples,
    example => example.predictedState,
    example => example.humanAnnotation?.annotatedState
  );
  const currentStrategyAgreementRate = buildShadowAgreementRate(
    reviewedExamples,
    example => example.predictedStrategy,
    example => example.humanAnnotation?.annotatedStrategy
  );

  const slices: ShadowProviderComparisonSlice[] = profiles
    .filter(entry => !!entry.profile)
    .map(entry => {
      const stateAgreementRate = buildShadowAgreementRate(
        reviewedExamples,
        example => predictWithReviewedCalibrationProfile(example.text, entry.profile).predictedState,
        example => example.humanAnnotation?.annotatedState
      );
      const strategyAgreementRate = buildShadowAgreementRate(
        reviewedExamples,
        example => predictWithReviewedCalibrationProfile(example.text, entry.profile).predictedStrategy,
        example => example.humanAnnotation?.annotatedStrategy
      );

      return {
        label: entry.label,
        providerLabel: entry.profile!.providerLabel,
        reviewedCount: entry.profile!.reviewedCount,
        stateAgreementRate,
        strategyAgreementRate,
        stateDeltaVsCurrent: toDelta(stateAgreementRate, currentStateAgreementRate),
        strategyDeltaVsCurrent: toDelta(strategyAgreementRate, currentStrategyAgreementRate),
      };
    });

  return {
    reviewedCount: reviewedExamples.length,
    currentStateAgreementRate,
    currentStrategyAgreementRate,
    slices,
  };
};

export const buildRecalibrationReport = (
  messages: Message[],
  analytics: ReasoningAnalyticsSnapshot,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {}
): RecalibrationReport => {
  const reviewedExamples = buildReasoningDatasetExamples(messages, analytics, annotationsByMessageId, { reviewedOnly: true });
  const adjustedCount = reviewedExamples.filter(example => example.humanAnnotation?.reviewDecision === 'adjusted').length;

  return {
    reviewedCount: reviewedExamples.length,
    adjustedCount,
    adjustmentRate: reviewedExamples.length > 0 ? Number((adjustedCount / reviewedExamples.length).toFixed(2)) : 0,
    stateAgreement: buildAgreementMetric(
      'State agreement',
      reviewedExamples,
      example => example.predictedState,
      example => example.humanAnnotation?.annotatedState
    ),
    strategyAgreement: buildAgreementMetric(
      'Strategy agreement',
      reviewedExamples,
      example => example.predictedStrategy,
      example => example.humanAnnotation?.annotatedStrategy
    ),
    moveAgreement: buildAgreementMetric(
      'Move agreement',
      reviewedExamples,
      example => example.recommendedMoves[0] || null,
      example => example.humanAnnotation?.annotatedMove
    ),
    stateHotspots: buildHotspots(
      reviewedExamples,
      example => example.predictedState,
      example => example.humanAnnotation?.annotatedState
    ),
    strategyHotspots: buildHotspots(
      reviewedExamples,
      example => example.predictedStrategy,
      example => example.humanAnnotation?.annotatedStrategy
    ),
    moveHotspots: buildHotspots(
      reviewedExamples,
      example => example.recommendedMoves[0] || null,
      example => example.humanAnnotation?.annotatedMove
    ),
    riskSlices: [
      buildRiskSlice('Low confidence / review-needed', reviewedExamples, example => example.requiresReview || example.confidence < 0.45),
      buildRiskSlice('Swarm-triggered', reviewedExamples, example => example.signals.some(signal => signal.label === 'Swarm adjudication')),
      buildRiskSlice('Surface-risk flagged', reviewedExamples, example => example.surfaceComplianceRisk > 0.62),
      buildRiskSlice('Convergence-risk flagged', reviewedExamples, example => example.prematureConvergenceRisk > 0.68),
    ],
    providerSlices: buildProviderSlices(reviewedExamples),
  };
};

const downloadFile = (content: string, fileName: string, contentType: string) => {
  const anchor = document.createElement('a');
  const file = new Blob([content], { type: contentType });
  anchor.href = URL.createObjectURL(file);
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

export const downloadReasoningDatasetJsonl = (
  messages: Message[],
  analytics: ReasoningAnalyticsSnapshot,
  user: User | null,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {},
  options: { reviewedOnly?: boolean } = {}
) => {
  const examples = buildReasoningDatasetExamples(messages, analytics, annotationsByMessageId, options);
  const payload = examples.map(example => JSON.stringify(example)).join('\n');
  const owner = user?.name?.replace(/\s+/g, '_') || 'anonymous';
  downloadFile(
    payload,
    `ethobot_reasoning_dataset_${options.reviewedOnly ? 'reviewed_' : ''}${owner}_${new Date().toISOString().split('T')[0]}.jsonl`,
    'application/x-ndjson'
  );
};

export const downloadReasoningDatasetJson = (
  messages: Message[],
  analytics: ReasoningAnalyticsSnapshot,
  user: User | null,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {},
  options: { reviewedOnly?: boolean } = {}
) => {
  const examples = buildReasoningDatasetExamples(messages, analytics, annotationsByMessageId, options);
  const owner = user?.name?.replace(/\s+/g, '_') || 'anonymous';
  downloadFile(
    JSON.stringify(
      {
        schemaVersion: REASONING_DATASET_SCHEMA_VERSION,
        provider: analytics.provider,
        exportedAt: new Date().toISOString(),
        reviewedOnly: !!options.reviewedOnly,
        examples,
      },
      null,
      2
    ),
    `ethobot_reasoning_dataset_${options.reviewedOnly ? 'reviewed_' : ''}${owner}_${new Date().toISOString().split('T')[0]}.json`,
    'application/json'
  );
};

export const downloadRecalibrationReportJson = (
  messages: Message[],
  analytics: ReasoningAnalyticsSnapshot,
  user: User | null,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {}
) => {
  const owner = user?.name?.replace(/\s+/g, '_') || 'anonymous';
  const report = buildRecalibrationReport(messages, analytics, annotationsByMessageId);

  downloadFile(
    JSON.stringify(
      {
        schemaVersion: REASONING_DATASET_SCHEMA_VERSION,
        provider: analytics.provider,
        exportedAt: new Date().toISOString(),
        report,
      },
      null,
      2
    ),
    `ethobot_recalibration_report_${owner}_${new Date().toISOString().split('T')[0]}.json`,
    'application/json'
  );
};

export const downloadEvaluationPipelineJson = (
  messages: Message[],
  analytics: ReasoningAnalyticsSnapshot,
  user: User | null,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {}
) => {
  const owner = user?.name?.replace(/\s+/g, '_') || 'anonymous';
  const allExamples = buildReasoningDatasetExamples(messages, analytics, annotationsByMessageId);
  const reviewedExamples = buildReasoningDatasetExamples(messages, analytics, annotationsByMessageId, { reviewedOnly: true });
  const recalibrationReport = buildRecalibrationReport(messages, analytics, annotationsByMessageId);

  downloadFile(
    JSON.stringify(
      {
        schemaVersion: REASONING_DATASET_SCHEMA_VERSION,
        provider: analytics.provider,
        exportedAt: new Date().toISOString(),
        evaluationSummary: {
          totalExamples: allExamples.length,
          reviewedExamples: reviewedExamples.length,
          providerCount: new Set(allExamples.map(example => example.provider)).size,
          reviewCoverage: allExamples.length > 0 ? Number((reviewedExamples.length / allExamples.length).toFixed(2)) : 0,
        },
        recalibrationReport,
        reviewedExamples,
      },
      null,
      2
    ),
    `ethobot_evaluation_pipeline_${owner}_${new Date().toISOString().split('T')[0]}.json`,
    'application/json'
  );
};

export const downloadShadowProviderComparisonJson = (
  messages: Message[],
  analytics: ReasoningAnalyticsSnapshot,
  user: User | null,
  annotationsByMessageId: Record<string, HumanReasoningAnnotation> = {},
  profiles: Array<{ label: string; profile: ReviewedCalibrationProfile | null }> = []
) => {
  const owner = user?.name?.replace(/\s+/g, '_') || 'anonymous';
  const report = buildShadowProviderComparisonReport(messages, analytics, annotationsByMessageId, profiles);

  downloadFile(
    JSON.stringify(
      {
        schemaVersion: REASONING_DATASET_SCHEMA_VERSION,
        provider: analytics.provider,
        exportedAt: new Date().toISOString(),
        report,
      },
      null,
      2
    ),
    `ethobot_shadow_provider_report_${owner}_${new Date().toISOString().split('T')[0]}.json`,
    'application/json'
  );
};

export const downloadReviewedCalibrationProfileJson = (
  profile: ReviewedCalibrationProfile | null,
  user: User | null
) => {
  if (!profile) {
    return;
  }

  const owner = user?.name?.replace(/\s+/g, '_') || 'anonymous';
  downloadFile(
    JSON.stringify(
      {
        schemaVersion: profile.schemaVersion,
        provider: profile.providerLabel,
        exportedAt: new Date().toISOString(),
        profile,
      },
      null,
      2
    ),
    `ethobot_reviewed_profile_${owner}_${new Date().toISOString().split('T')[0]}.json`,
    'application/json'
  );
};
