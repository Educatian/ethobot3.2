import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, BrainCircuit, Download, Gauge, GitBranch, ShieldAlert, Sparkles, Upload, Workflow } from 'lucide-react';
import { DiscourseStrategy, PedagogicalMove, ReasoningState } from '../types';
import type {
  HumanReasoningAnnotation,
  Message,
  RecalibrationHotspot,
  ReasoningAnalyticsSnapshot,
  ReviewedCalibrationProfile,
  TeacherReviewQueueItem,
  User,
} from '../types';
import { createTeacherAnalyticsViewModel } from '../services/reasoningAnalyticsService';
import {
  buildShadowProviderComparisonReport,
  buildRecalibrationReport,
  downloadEvaluationPipelineJson,
  downloadRecalibrationReportJson,
  downloadReviewedCalibrationProfileJson,
  downloadReasoningDatasetJson,
  downloadReasoningDatasetJsonl,
  downloadShadowProviderComparisonJson,
} from '../services/reasoningDatasetService';

interface TeacherAnalyticsPanelProps {
  analytics: ReasoningAnalyticsSnapshot;
  messages: Message[];
  user: User | null;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
  reasoningAnnotations: Record<string, HumanReasoningAnnotation>;
  localReviewedCalibrationProfile: ReviewedCalibrationProfile | null;
  importedReviewedCalibrationProfile: ReviewedCalibrationProfile | null;
  reviewedCalibrationProfile: ReviewedCalibrationProfile | null;
  queuedInstructorOverride: PedagogicalMove | null;
  onQueueInstructorOverride: (move: PedagogicalMove) => void;
  onClearInstructorOverride: () => void;
  onSaveReasoningAnnotation: (
    messageId: string,
    annotation: {
      annotatedState: ReasoningState | null;
      annotatedStrategy: DiscourseStrategy | null;
      annotatedMove: PedagogicalMove | null;
      reviewDecision: HumanReasoningAnnotation['reviewDecision'];
      reviewerNotes: string;
    }
  ) => void;
  onClearReasoningAnnotation: (messageId: string) => void;
  onImportReviewedCalibrationProfile: (payload: unknown) => boolean;
  onClearImportedReviewedCalibrationProfile: () => void;
}

const statusStyle: Record<string, string> = {
  balanced: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  stagnation: 'bg-amber-50 text-amber-700 border-amber-200',
  fragmentation: 'bg-rose-50 text-rose-700 border-rose-200',
  review: 'bg-slate-100 text-slate-700 border-slate-200',
};

const overrideMoves = [
  PedagogicalMove.COUNTER_PERSPECTIVE,
  PedagogicalMove.JUSTIFICATION_REQUEST,
  PedagogicalMove.VALUE_PROBE,
  PedagogicalMove.CLOSURE_DELAY,
  PedagogicalMove.TRADEOFF_EXPLORATION,
  PedagogicalMove.SELF_EVALUATION_PROMPT,
];

const stateOptions = Object.values(ReasoningState);
const strategyOptions = Object.values(DiscourseStrategy);
const moveOptions = Object.values(PedagogicalMove);
const sectionCardClass = 'mt-4 rounded-[1.5rem] border p-4 shadow-sm';
const ivoryCardClass = 'rounded-2xl border border-lyceum-line bg-[#fffaf0] p-3 shadow-sm';
const softMetricCardClass = 'rounded-2xl border border-lyceum-line bg-[#fffaf0] p-3 shadow-sm';
const microLabelClass = 'text-[10px] font-extrabold uppercase tracking-[0.24em] text-lyceum-muted';
const bodyMutedClass = 'text-[11px] text-lyceum-muted';

const HotspotList: React.FC<{ title: string; hotspots: RecalibrationHotspot[] }> = ({ title, hotspots }) => (
  <div className={ivoryCardClass}>
    <p className={microLabelClass}>{title}</p>
    <div className="mt-2 space-y-1">
      {hotspots.length > 0 ? (
        hotspots.map(hotspot => (
          <p key={`${title}-${hotspot.fromLabel}-${hotspot.toLabel}`} className="text-[11px] text-lyceum-ink">
            <span className="font-semibold text-lyceum-ink">{hotspot.fromLabel}</span> to <span className="font-semibold text-lyceum-ink">{hotspot.toLabel}</span> in {hotspot.count} reviewed turns.
          </p>
        ))
      ) : (
        <p className={bodyMutedClass}>No strong correction hotspot yet.</p>
      )}
    </div>
  </div>
);

interface ReviewQueueCardProps {
  item: TeacherReviewQueueItem;
  messageText: string;
  predictedState: ReasoningState | null;
  predictedStrategy: DiscourseStrategy | null;
  predictedMove: PedagogicalMove | null;
  annotation?: HumanReasoningAnnotation;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
  onSaveReasoningAnnotation: TeacherAnalyticsPanelProps['onSaveReasoningAnnotation'];
  onClearReasoningAnnotation: TeacherAnalyticsPanelProps['onClearReasoningAnnotation'];
}

const ReviewQueueCard: React.FC<ReviewQueueCardProps> = ({
  item,
  messageText,
  predictedState,
  predictedStrategy,
  predictedMove,
  annotation,
  onLogClick,
  onSaveReasoningAnnotation,
  onClearReasoningAnnotation,
}) => {
  const [annotatedState, setAnnotatedState] = useState<ReasoningState | ''>(annotation?.annotatedState || predictedState || '');
  const [annotatedStrategy, setAnnotatedStrategy] = useState<DiscourseStrategy | ''>(annotation?.annotatedStrategy || predictedStrategy || '');
  const [annotatedMove, setAnnotatedMove] = useState<PedagogicalMove | ''>(annotation?.annotatedMove || predictedMove || '');
  const [reviewerNotes, setReviewerNotes] = useState(annotation?.reviewerNotes || '');

  useEffect(() => {
    setAnnotatedState(annotation?.annotatedState || predictedState || '');
    setAnnotatedStrategy(annotation?.annotatedStrategy || predictedStrategy || '');
    setAnnotatedMove(annotation?.annotatedMove || predictedMove || '');
    setReviewerNotes(annotation?.reviewerNotes || '');
  }, [annotation, predictedMove, predictedState, predictedStrategy]);

  const saveAnnotation = (
    reviewDecision: HumanReasoningAnnotation['reviewDecision'],
    overrides?: {
      annotatedState?: ReasoningState | null;
      annotatedStrategy?: DiscourseStrategy | null;
      annotatedMove?: PedagogicalMove | null;
    }
  ) => {
    onSaveReasoningAnnotation(item.messageId, {
      annotatedState: (overrides?.annotatedState ?? annotatedState) || null,
      annotatedStrategy: (overrides?.annotatedStrategy ?? annotatedStrategy) || null,
      annotatedMove: (overrides?.annotatedMove ?? annotatedMove) || null,
      reviewDecision,
      reviewerNotes: reviewerNotes.trim(),
    });
  };

  return (
    <div className={ivoryCardClass}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-headline text-lg font-bold tracking-tight text-lyceum-ink">{item.title}</p>
        <div className="flex items-center gap-2">
          {annotation && (
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
              annotation.reviewDecision === 'adjusted'
                ? 'border border-blue-200 bg-blue-50 text-blue-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}>
              {annotation.reviewDecision === 'adjusted' ? 'Reviewed' : 'AI Confirmed'}
            </span>
          )}
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            item.priority === 'high'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : item.priority === 'medium'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            {item.priority}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-lyceum-ink/80">{item.summary}</p>
      <p className="mt-2 rounded-xl border border-lyceum-line/70 bg-[#f4efe2] px-3 py-2 text-xs text-lyceum-ink/75">
        {messageText || 'Learner message unavailable.'}
      </p>
      <p className={`mt-2 ${bodyMutedClass}`}>{item.recommendedAction}</p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-[11px] font-semibold text-lyceum-muted">
          State
          <select
            value={annotatedState}
            onChange={event => setAnnotatedState(event.target.value as ReasoningState | '')}
            className="mt-1 w-full rounded-xl border border-lyceum-line bg-white px-2 py-2 text-xs text-lyceum-ink"
          >
            <option value="">Unspecified</option>
            {stateOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-lyceum-muted">
          Strategy
          <select
            value={annotatedStrategy}
            onChange={event => setAnnotatedStrategy(event.target.value as DiscourseStrategy | '')}
            className="mt-1 w-full rounded-xl border border-lyceum-line bg-white px-2 py-2 text-xs text-lyceum-ink"
          >
            <option value="">Unspecified</option>
            {strategyOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-lyceum-muted">
          Move
          <select
            value={annotatedMove}
            onChange={event => setAnnotatedMove(event.target.value as PedagogicalMove | '')}
            className="mt-1 w-full rounded-xl border border-lyceum-line bg-white px-2 py-2 text-xs text-lyceum-ink"
          >
            <option value="">Unspecified</option>
            {moveOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block text-[11px] font-semibold text-lyceum-muted">
        Reviewer Notes
        <textarea
          value={reviewerNotes}
          onChange={event => setReviewerNotes(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-lyceum-line bg-white px-3 py-2 text-xs text-lyceum-ink"
          placeholder="Optional note on why the AI read was confirmed or adjusted."
        />
      </label>

      <div className="mt-4 rounded-[1.35rem] border border-lyceum-line/80 bg-[#fbf7ef] p-3">
        <p className={microLabelClass}>Research Exports</p>
        <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => {
            onLogClick(`confirm-ai-review-${item.messageId}`, 'button', 'Confirm AI Review');
            setAnnotatedState(predictedState || '');
            setAnnotatedStrategy(predictedStrategy || '');
            setAnnotatedMove(predictedMove || '');
            saveAnnotation('confirmed_ai', {
              annotatedState: predictedState,
              annotatedStrategy: predictedStrategy,
              annotatedMove: predictedMove,
            });
          }}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          Confirm AI Read
        </button>
        <button
          onClick={() => {
            onLogClick(`save-reviewed-labels-${item.messageId}`, 'button', 'Save Reviewed Labels');
            saveAnnotation('adjusted');
          }}
          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
        >
          Save Review
        </button>
        {annotation && (
          <button
            onClick={() => {
              onLogClick(`clear-reviewed-labels-${item.messageId}`, 'button', 'Clear Reviewed Labels');
              onClearReasoningAnnotation(item.messageId);
            }}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
          >
            Clear Review
          </button>
        )}
      </div>
      </div>
    </div>
  );
};

const TeacherAnalyticsPanel: React.FC<TeacherAnalyticsPanelProps> = ({
  analytics,
  messages,
  user,
  onLogClick,
  reasoningAnnotations,
  localReviewedCalibrationProfile,
  importedReviewedCalibrationProfile,
  reviewedCalibrationProfile,
  queuedInstructorOverride,
  onQueueInstructorOverride,
  onClearInstructorOverride,
  onSaveReasoningAnnotation,
  onClearReasoningAnnotation,
  onImportReviewedCalibrationProfile,
  onClearImportedReviewedCalibrationProfile,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewModel = createTeacherAnalyticsViewModel(analytics);
  const recalibrationReport = useMemo(
    () => buildRecalibrationReport(messages, analytics, reasoningAnnotations),
    [messages, analytics, reasoningAnnotations]
  );
  const shadowProviderReport = useMemo(
    () =>
      buildShadowProviderComparisonReport(messages, analytics, reasoningAnnotations, [
        { label: 'Local Profile', profile: localReviewedCalibrationProfile },
        { label: 'Imported Profile', profile: importedReviewedCalibrationProfile },
        { label: 'Active Merged Profile', profile: reviewedCalibrationProfile },
      ]),
    [
      messages,
      analytics,
      reasoningAnnotations,
      localReviewedCalibrationProfile,
      importedReviewedCalibrationProfile,
      reviewedCalibrationProfile,
    ]
  );
  const sessionDashboard = useMemo(() => {
    const learnerAnalyses = analytics.analyses.filter(entry => entry.sender === 'user');
    const overrideCount = analytics.designResponseTraces.filter(trace => trace.moveSource === 'instructor_override').length;
    const swarmCount = learnerAnalyses.filter(analysis => !!analysis.swarmTrace).length;
    const flaggedCount = learnerAnalyses.filter(
      analysis => analysis.requiresReview || analysis.surfaceComplianceRisk > 0.62 || analysis.prematureConvergenceRisk > 0.68
    ).length;

    return {
      learnerTurnCount: learnerAnalyses.length,
      flaggedCount,
      overrideCount,
      swarmCount,
    };
  }, [analytics]);
  const annotationStats = useMemo(() => {
    const annotations = Object.values(reasoningAnnotations);
    const reviewedCount = annotations.length;
    const adjustedCount = annotations.filter(annotation => annotation.reviewDecision === 'adjusted').length;
    const confirmedCount = annotations.filter(annotation => annotation.reviewDecision === 'confirmed_ai').length;

    return {
      reviewedCount,
      adjustedCount,
      confirmedCount,
      adjustmentRate: reviewedCount > 0 ? Math.round((adjustedCount / reviewedCount) * 100) : 0,
    };
  }, [reasoningAnnotations]);
  const learnerAnalysesById = useMemo(
    () => new Map(analytics.analyses.filter(entry => entry.sender === 'user').map(entry => [entry.messageId, entry])),
    [analytics.analyses]
  );
  const messageById = useMemo(
    () => new Map(messages.map(message => [message.id, message])),
    [messages]
  );
  const appliedMoveByMessageId = useMemo(() => {
    const nextMap = new Map<string, PedagogicalMove[]>();
    analytics.designResponseTraces.forEach(trace => {
      nextMap.set(trace.sourceMessageId, trace.appliedMoves);
    });
    if (analytics.currentMovePlan) {
      nextMap.set(
        analytics.currentMovePlan.selectedAtMessageId,
        [
          analytics.currentMovePlan.primaryMove,
          ...(analytics.currentMovePlan.secondaryMove ? [analytics.currentMovePlan.secondaryMove] : []),
        ]
      );
    }
    return nextMap;
  }, [analytics.currentMovePlan, analytics.designResponseTraces]);
  const monitoringAlerts = [
    ...viewModel.cautionFlags,
    ...(viewModel.latestSwarmTrace ? [`Swarm adjudication triggered: ${viewModel.latestSwarmTrace.triggerReason}`] : []),
  ];
  const runtimeStatuses = [
    {
      label: 'Embedding',
      ...analytics.runtimeStability.embedding,
    },
    {
      label: 'Swarm',
      ...analytics.runtimeStability.swarm,
    },
  ];

  const handleImportProfileClick = () => {
    onLogClick('import-reviewed-profile', 'button', 'Import Reviewed Profile');
    fileInputRef.current?.click();
  };

  const handleImportedProfileFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      onImportReviewedCalibrationProfile(parsed);
    } catch (error) {
      console.error('Unable to import reviewed profile.', error);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[#f6f0e2] p-4 text-lyceum-ink shadow-panel">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportedProfileFile}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-gray-800">
            <BrainCircuit size={16} className="text-alabama-crimson" />
            <h3 className="font-headline text-2xl font-bold tracking-tight">Instructor Analytics</h3>
          </div>
          <p className="mt-1 text-xs text-lyceum-muted">
            Diagnostic view for identifying loops, transitions, and next interventions.
          </p>
          <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">
            Provider: {analytics.provider}
          </p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${statusStyle[viewModel.statusTone]}`}>
          {viewModel.statusTone}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => {
            onLogClick('export-reasoning-dataset-jsonl', 'button', 'Export JSONL');
            downloadReasoningDatasetJsonl(messages, analytics, user, reasoningAnnotations);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-white"
        >
          <Download size={12} />
          Export JSONL
        </button>
        <button
          onClick={() => {
            onLogClick('export-reasoning-dataset-json', 'button', 'Export JSON');
            downloadReasoningDatasetJson(messages, analytics, user, reasoningAnnotations);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-white"
        >
          <Download size={12} />
          Export JSON
        </button>
        <button
          onClick={() => {
            onLogClick('export-reviewed-dataset-jsonl', 'button', 'Export Reviewed JSONL');
            downloadReasoningDatasetJsonl(messages, analytics, user, reasoningAnnotations, { reviewedOnly: true });
          }}
          className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
        >
          <Download size={12} />
          Reviewed JSONL
        </button>
        <button
          onClick={() => {
            onLogClick('export-reviewed-profile-json', 'button', 'Export Reviewed Profile');
            downloadReviewedCalibrationProfileJson(reviewedCalibrationProfile, user);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
          disabled={!reviewedCalibrationProfile}
        >
          <Download size={12} />
          Reviewed Profile
        </button>
        <button
          onClick={handleImportProfileClick}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-100"
        >
          <Upload size={12} />
          Import Profile
        </button>
        {importedReviewedCalibrationProfile && (
          <button
            onClick={() => {
              onLogClick('clear-imported-reviewed-profile', 'button', 'Clear Imported Profile');
              onClearImportedReviewedCalibrationProfile();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
          >
            Clear Imported
          </button>
        )}
        <button
          onClick={() => {
            onLogClick('export-recalibration-report-json', 'button', 'Export Recalibration Report');
            downloadRecalibrationReportJson(messages, analytics, user, reasoningAnnotations);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          <Download size={12} />
          Recalibration Report
        </button>
        <button
          onClick={() => {
            onLogClick('export-evaluation-pipeline-json', 'button', 'Export Evaluation Pipeline');
            downloadEvaluationPipelineJson(messages, analytics, user, reasoningAnnotations);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-[11px] font-semibold text-purple-700 hover:bg-purple-100"
        >
          <Download size={12} />
          Evaluation Pipeline
        </button>
        <button
          onClick={() => {
            onLogClick('export-shadow-provider-json', 'button', 'Export Shadow Provider Report');
            downloadShadowProviderComparisonJson(messages, analytics, user, reasoningAnnotations, [
              { label: 'Local Profile', profile: localReviewedCalibrationProfile },
              { label: 'Imported Profile', profile: importedReviewedCalibrationProfile },
              { label: 'Active Merged Profile', profile: reviewedCalibrationProfile },
            ]);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
        >
          <Download size={12} />
          Shadow Report
        </button>
      </div>

      <div className={`${sectionCardClass} border-emerald-100 bg-emerald-50/70`}>
        <div className="flex items-center gap-2 text-emerald-900">
          <BrainCircuit size={14} />
          <p className={microLabelClass}>Recalibration Readiness</p>
        </div>
        <p className="mt-2 text-xs text-emerald-900/80">
          {annotationStats.reviewedCount > 0
            ? `${annotationStats.reviewedCount} reviewed turns collected. ${annotationStats.adjustedCount} were adjusted and ${annotationStats.confirmedCount} confirmed the AI read. Adjustment rate: ${annotationStats.adjustmentRate}%.`
            : 'No reviewed turns yet. Save supervisory reviews to build a recalibration-ready corpus.'}
        </p>
        <p className="mt-2 text-[11px] text-emerald-900/70">
          {reviewedCalibrationProfile
            ? `Persistent reviewed profile ${reviewedCalibrationProfile.providerLabel} is active with ${reviewedCalibrationProfile.reviewedCount} reviewed turns.`
            : 'Persistent reviewed profile will appear once enough reviewed turns accumulate.'}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Local Profile</p>
            <p className="mt-1 text-xs font-semibold text-lyceum-ink">
              {localReviewedCalibrationProfile ? localReviewedCalibrationProfile.reviewedCount : 0} reviewed turns
            </p>
          </div>
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Imported Profile</p>
            <p className="mt-1 text-xs font-semibold text-lyceum-ink">
              {importedReviewedCalibrationProfile ? importedReviewedCalibrationProfile.reviewedCount : 0} reviewed turns
            </p>
          </div>
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Active Profile</p>
            <p className="mt-1 text-xs font-semibold text-lyceum-ink">
              {reviewedCalibrationProfile ? reviewedCalibrationProfile.providerLabel : 'inactive'}
            </p>
          </div>
        </div>
      </div>

      <div className={`${sectionCardClass} border-slate-200 bg-slate-50`}>
        <div className="flex items-center gap-2 text-slate-700">
          <ShieldAlert size={14} />
          <p className={microLabelClass}>Runtime Stability</p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {runtimeStatuses.map(status => (
            <div key={status.label} className={softMetricCardClass}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-lyceum-ink">{status.label}</p>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {status.status}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-lyceum-ink/75">
                Failures: {status.consecutiveFailures}
              </p>
              <p className={`mt-1 ${bodyMutedClass}`}>
                Cooldown: {status.cooldownRemainingMs > 0 ? `${Math.ceil(status.cooldownRemainingMs / 1000)}s` : '0s'}
              </p>
              {status.lastError && (
                <p className="mt-1 text-[11px] text-amber-700">{status.lastError}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={`${sectionCardClass} border-blue-200 bg-blue-50/60`}>
        <div className="flex items-center gap-2 text-blue-900">
          <Activity size={14} />
          <p className={microLabelClass}>Session Dashboard</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Learner Turns</p>
            <p className="mt-1 text-sm font-semibold text-lyceum-ink">{sessionDashboard.learnerTurnCount}</p>
          </div>
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Flagged Turns</p>
            <p className="mt-1 text-sm font-semibold text-lyceum-ink">{sessionDashboard.flaggedCount}</p>
          </div>
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Swarm Turns</p>
            <p className="mt-1 text-sm font-semibold text-lyceum-ink">{sessionDashboard.swarmCount}</p>
          </div>
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Overrides</p>
            <p className="mt-1 text-sm font-semibold text-lyceum-ink">{sessionDashboard.overrideCount}</p>
          </div>
        </div>
      </div>

      <div className={`${sectionCardClass} border-emerald-200 bg-emerald-50/60`}>
        <div className="flex items-center gap-2 text-emerald-900">
          <Gauge size={14} />
          <p className={microLabelClass}>Provider Evaluation</p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>State Agreement</p>
            <p className="mt-1 text-sm font-semibold text-lyceum-ink">
              {recalibrationReport.stateAgreement.rate === null ? '--' : `${Math.round(recalibrationReport.stateAgreement.rate * 100)}%`}
            </p>
            <p className={`mt-1 ${bodyMutedClass}`}>
              {recalibrationReport.stateAgreement.agreed} of {recalibrationReport.stateAgreement.total} reviewed turns
            </p>
          </div>
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Strategy Agreement</p>
            <p className="mt-1 text-sm font-semibold text-lyceum-ink">
              {recalibrationReport.strategyAgreement.rate === null ? '--' : `${Math.round(recalibrationReport.strategyAgreement.rate * 100)}%`}
            </p>
            <p className={`mt-1 ${bodyMutedClass}`}>
              {recalibrationReport.strategyAgreement.agreed} of {recalibrationReport.strategyAgreement.total} reviewed turns
            </p>
          </div>
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Move Agreement</p>
            <p className="mt-1 text-sm font-semibold text-lyceum-ink">
              {recalibrationReport.moveAgreement.rate === null ? '--' : `${Math.round(recalibrationReport.moveAgreement.rate * 100)}%`}
            </p>
            <p className={`mt-1 ${bodyMutedClass}`}>
              {recalibrationReport.moveAgreement.agreed} of {recalibrationReport.moveAgreement.total} reviewed turns
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {recalibrationReport.riskSlices.map(slice => (
            <div key={slice.label} className={softMetricCardClass}>
              <p className={microLabelClass}>{slice.label}</p>
              <p className="mt-1 text-xs text-lyceum-ink/80">
                Reviewed turns: <span className="font-semibold text-lyceum-ink">{slice.reviewedCount}</span>
              </p>
              <p className={`mt-1 ${bodyMutedClass}`}>
                State agreement: {slice.stateAgreementRate === null ? '--' : `${Math.round(slice.stateAgreementRate * 100)}%`}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {recalibrationReport.providerSlices.length > 0 ? (
            recalibrationReport.providerSlices.map(slice => (
              <div key={slice.providerLabel} className={softMetricCardClass}>
                <p className={microLabelClass}>Provider Slice</p>
                <p className="mt-1 text-xs font-semibold text-lyceum-ink">{slice.providerLabel}</p>
                <p className="mt-1 text-[11px] text-lyceum-ink/75">Reviewed turns: {slice.reviewedCount}</p>
                <p className={`mt-1 ${bodyMutedClass}`}>
                  State agreement: {slice.stateAgreementRate === null ? '--' : `${Math.round(slice.stateAgreementRate * 100)}%`}
                </p>
                <p className={`mt-1 ${bodyMutedClass}`}>
                  Adjustment rate: {slice.adjustmentRate === null ? '--' : `${Math.round(slice.adjustmentRate * 100)}%`}
                </p>
              </div>
            ))
          ) : (
            <div className={softMetricCardClass}>
              <p className="text-xs text-lyceum-muted">Provider comparison will appear after reviewed turns accumulate.</p>
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <HotspotList title="State Hotspots" hotspots={recalibrationReport.stateHotspots} />
          <HotspotList title="Strategy Hotspots" hotspots={recalibrationReport.strategyHotspots} />
          <HotspotList title="Move Hotspots" hotspots={recalibrationReport.moveHotspots} />
        </div>
      </div>

      <div className={`${sectionCardClass} border-amber-200 bg-amber-50/60`}>
        <div className="flex items-center gap-2 text-amber-900">
          <GitBranch size={14} />
          <p className={microLabelClass}>Shadow Provider Comparison</p>
        </div>
        <p className="mt-2 text-xs text-amber-900/80">
          Profile-only shadow scoring is compared against the current recorded predictions on the reviewed subset.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Current State Agreement</p>
            <p className="mt-1 text-sm font-semibold text-lyceum-ink">
              {shadowProviderReport.currentStateAgreementRate === null ? '--' : `${Math.round(shadowProviderReport.currentStateAgreementRate * 100)}%`}
            </p>
            <p className={`mt-1 ${bodyMutedClass}`}>
              Based on {shadowProviderReport.reviewedCount} reviewed turns
            </p>
          </div>
          <div className={softMetricCardClass}>
            <p className={microLabelClass}>Current Strategy Agreement</p>
            <p className="mt-1 text-sm font-semibold text-lyceum-ink">
              {shadowProviderReport.currentStrategyAgreementRate === null ? '--' : `${Math.round(shadowProviderReport.currentStrategyAgreementRate * 100)}%`}
            </p>
            <p className={`mt-1 ${bodyMutedClass}`}>
              Shadow deltas below are measured against this baseline
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {shadowProviderReport.slices.length > 0 ? (
            shadowProviderReport.slices.map(slice => (
              <div key={`${slice.label}-${slice.providerLabel}`} className={softMetricCardClass}>
                <p className={microLabelClass}>{slice.label}</p>
                <p className="mt-1 text-xs font-semibold text-lyceum-ink">{slice.providerLabel}</p>
                <p className="mt-2 text-[11px] text-lyceum-ink/75">
                  State agreement: {slice.stateAgreementRate === null ? '--' : `${Math.round(slice.stateAgreementRate * 100)}%`}
                </p>
                <p className={`mt-1 ${bodyMutedClass}`}>
                  State delta: {slice.stateDeltaVsCurrent === null ? '--' : `${slice.stateDeltaVsCurrent > 0 ? '+' : ''}${Math.round(slice.stateDeltaVsCurrent * 100)}%`}
                </p>
                <p className="mt-1 text-[11px] text-lyceum-ink/75">
                  Strategy agreement: {slice.strategyAgreementRate === null ? '--' : `${Math.round(slice.strategyAgreementRate * 100)}%`}
                </p>
                <p className={`mt-1 ${bodyMutedClass}`}>
                  Strategy delta: {slice.strategyDeltaVsCurrent === null ? '--' : `${slice.strategyDeltaVsCurrent > 0 ? '+' : ''}${Math.round(slice.strategyDeltaVsCurrent * 100)}%`}
                </p>
              </div>
            ))
          ) : (
            <div className={`${softMetricCardClass} sm:col-span-3`}>
              <p className="text-xs text-lyceum-muted">Shadow comparison will appear once a reviewed profile is available.</p>
            </div>
          )}
        </div>
      </div>

      <div className={`${sectionCardClass} border-lyceum-line bg-[#f1ece0]`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={microLabelClass}>Selective Override</p>
            <p className="mt-1 text-xs text-lyceum-ink/75">Queue one instructor-selected move for the next adaptive response only.</p>
          </div>
          {queuedInstructorOverride && (
            <button
              onClick={() => {
                onLogClick('clear-instructor-override', 'button', 'Clear Override');
                onClearInstructorOverride();
              }}
              className="rounded-full border border-lyceum-line bg-white px-3 py-1.5 text-[11px] font-semibold text-lyceum-ink hover:bg-[#f8f3e8]"
            >
              Clear
            </button>
          )}
        </div>
        {queuedInstructorOverride && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
            <p className="text-xs font-semibold text-blue-900">Queued override: {queuedInstructorOverride}</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {overrideMoves.map(move => (
            <button
              key={move}
              onClick={() => {
                onLogClick(`queue-override-${move}`, 'button', move);
                onQueueInstructorOverride(move);
              }}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                queuedInstructorOverride === move
                  ? 'border-alabama-crimson bg-crimson-light text-alabama-crimson'
                  : 'border-lyceum-line bg-white text-lyceum-ink hover:bg-[#f8f3e8]'
              }`}
            >
              {move}
            </button>
          ))}
        </div>
      </div>

      <div className={`${sectionCardClass} border-blue-100 bg-blue-50/70`}>
        <div className="flex items-center gap-2 text-blue-900">
          <Activity size={14} />
          <p className={microLabelClass}>Monitoring Mode</p>
        </div>
        <p className="mt-2 text-xs text-blue-900/80">
          {viewModel.monitoringSummary}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className={softMetricCardClass}>
          <p className={microLabelClass}>Current State</p>
          <p className="mt-1 text-sm font-semibold text-lyceum-ink">{viewModel.currentStateLabel}</p>
        </div>
        <div className={softMetricCardClass}>
          <p className={microLabelClass}>Strategy</p>
          <p className="mt-1 text-sm font-semibold text-lyceum-ink">{viewModel.currentStrategyLabel}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className={softMetricCardClass}>
          <div className={`flex items-center gap-1 ${microLabelClass}`}>
            <Gauge size={12} />
            Confidence
          </div>
          <p className="mt-1 text-sm font-semibold text-lyceum-ink">{viewModel.confidenceLabel}</p>
        </div>
        <div className={softMetricCardClass}>
          <div className={`flex items-center gap-1 ${microLabelClass}`}>
            <BrainCircuit size={12} />
            CDOI
          </div>
          <p className="mt-1 text-sm font-semibold text-lyceum-ink">{viewModel.cdoiLabel}</p>
          <p className={`mt-1 ${bodyMutedClass}`}>{viewModel.cdoiTrajectoryLabel}</p>
        </div>
        <div className={softMetricCardClass}>
          <div className={`flex items-center gap-1 ${microLabelClass}`}>
            <Sparkles size={12} />
            Entropy
          </div>
          <p className="mt-1 text-sm font-semibold text-lyceum-ink">{viewModel.entropyLabel}</p>
        </div>
        <div className={softMetricCardClass}>
          <div className={`flex items-center gap-1 ${microLabelClass}`}>
            <AlertTriangle size={12} />
            Convergence
          </div>
          <p className="mt-1 text-sm font-semibold text-lyceum-ink">{viewModel.prematureConvergenceLabel}</p>
        </div>
        <div className={softMetricCardClass}>
          <div className={`flex items-center gap-1 ${microLabelClass}`}>
            <ShieldAlert size={12} />
            Surface Risk
          </div>
          <p className="mt-1 text-sm font-semibold text-lyceum-ink">{viewModel.surfaceComplianceLabel}</p>
        </div>
        <div className={`${softMetricCardClass} col-span-3`}>
          <div className={`flex items-center gap-1 ${microLabelClass}`}>
            <GitBranch size={12} />
            Coherence + Move
          </div>
          <p className="mt-1 text-sm font-semibold text-lyceum-ink">
            {viewModel.coherenceLabel} coherence, {viewModel.moveLabel}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className={microLabelClass}>Recent State Path</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {viewModel.recentStateLabels.length > 0 ? (
            viewModel.recentStateLabels.map((state, index) => (
              <span
                key={`${state}-${index}`}
                className="px-2 py-1 rounded-full bg-crimson-light text-alabama-crimson text-[11px] font-semibold"
              >
                {state}
              </span>
            ))
          ) : (
            <span className="text-xs text-lyceum-muted">No learner turns analyzed yet.</span>
          )}
        </div>
      </div>

      <div className={`${sectionCardClass} border-lyceum-line bg-[#f1ece0]`}>
        <p className={microLabelClass}>{viewModel.interventionTitle}</p>
        <p className="mt-2 text-xs text-lyceum-ink/80">{viewModel.interventionBody}</p>
        <div className={`mt-3 ${ivoryCardClass}`}>
          <p className={microLabelClass}>Sequence Policy</p>
          <p className="mt-1 text-xs text-lyceum-ink/80">{viewModel.sequencePolicySummary}</p>
        </div>
        <div className={`mt-3 ${ivoryCardClass}`}>
          <p className={microLabelClass}>CDOI Trajectory</p>
          <p className="mt-1 text-xs text-lyceum-ink/80">{viewModel.cdoiTrajectorySummary}</p>
        </div>
      </div>

      {viewModel.moveEffectiveness.length > 0 && (
        <div className={`${sectionCardClass} border-lyceum-line bg-[#f5efe3]`}>
          <div className="flex items-center gap-2 text-gray-700">
            <Gauge size={14} />
            <p className={microLabelClass}>Move Effectiveness</p>
          </div>
          <div className="mt-3 space-y-2">
            {viewModel.moveEffectiveness.map(summary => (
              <div key={summary.moveLabel} className={ivoryCardClass}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-lyceum-ink">{summary.moveLabel}</p>
                  <span className="rounded-full border border-lyceum-line bg-[#f8f3e8] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-lyceum-muted">
                    {summary.attempts} turns
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-lyceum-ink/75">
                  Perspective/reflective shift on {summary.reflectiveShiftCount} of {summary.attempts} traced responses.
                </p>
                <p className={`mt-1 ${bodyMutedClass}`}>
                  Average CDOI change: {summary.cdoiLiftAverage === null ? 'N/A' : `${summary.cdoiLiftAverage > 0 ? '+' : ''}${summary.cdoiLiftAverage}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {monitoringAlerts.length > 0 && (
        <div className="mt-3 rounded-[1.35rem] border border-amber-200 bg-amber-50 p-3 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <ShieldAlert size={14} />
            <p className={microLabelClass}>Risk Alerts</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {monitoringAlerts.map(flag => (
              <span key={flag} className="text-[11px] font-semibold text-amber-800 bg-white border border-amber-200 rounded-full px-2 py-1">
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {viewModel.latestSwarmTrace && (
        <div className={`${sectionCardClass} border-purple-200 bg-purple-50/60`}>
          <div className="flex items-center gap-2 text-purple-800">
            <BrainCircuit size={14} />
            <p className={microLabelClass}>Latest Swarm Adjudication</p>
          </div>
          <p className="mt-2 text-xs text-purple-900">
            Trigger: {viewModel.latestSwarmTrace.triggerReason}
          </p>
          <p className="mt-1 text-xs text-purple-900/80">
            Arbiter settled on {viewModel.latestSwarmTrace.arbiterState || 'review'} / {viewModel.latestSwarmTrace.arbiterStrategy || 'review'} / {viewModel.latestSwarmTrace.arbiterMove || 'no move override'} at {Math.round(viewModel.latestSwarmTrace.arbiterConfidence * 100)}% confidence.
          </p>
          <div className="mt-3 space-y-2">
            {viewModel.latestSwarmTrace.judgeVotes.map(vote => (
              <div key={vote.judgeId} className="rounded-xl border border-purple-200 bg-white/90 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-purple-900 uppercase tracking-wider">{vote.judgeId}</p>
                  <span className="text-[10px] font-bold text-purple-700">{Math.round(vote.confidence * 100)}%</span>
                </div>
                <p className="mt-1 text-[11px] text-lyceum-ink/80">
                  {vote.predictedState || vote.predictedStrategy || vote.predictedMove || 'No label'} selected.
                </p>
                <p className={`mt-1 ${bodyMutedClass}`}>{vote.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`${sectionCardClass} border-lyceum-line bg-[#f5efe3]`}>
        <div className="flex items-center gap-2 text-gray-700">
          <Workflow size={14} />
          <p className={microLabelClass}>Identify-Intervene-Verify</p>
        </div>
        <div className="mt-3 space-y-3">
          {viewModel.verificationItems.length > 0 ? (
            viewModel.verificationItems.map(trace => (
              <div key={`${trace.sourceMessageId}-${trace.responseMessageId}`} className={ivoryCardClass}>
                <p className={microLabelClass}>
                  Identify
                </p>
                <p className="mt-1 text-xs text-lyceum-ink/80">
                  Learner was read as <span className="font-semibold text-lyceum-ink">{trace.identifiedState}</span>.
                </p>
                <p className={`mt-2 ${microLabelClass}`}>
                  Intervene
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-lyceum-ink/80">
                    Applied move: <span className="font-semibold text-lyceum-ink">{trace.appliedMoveLabel}</span>
                  </p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    trace.moveSource === 'instructor_override'
                      ? 'border border-blue-200 bg-blue-50 text-blue-700'
                      : 'border border-gray-200 bg-gray-100 text-gray-600'
                  }`}>
                    {trace.moveSource === 'instructor_override' ? 'Instructor Override' : 'Automatic'}
                  </span>
                </div>
                <p className={`mt-2 ${microLabelClass}`}>
                  Verify
                </p>
                <p className="mt-1 text-xs text-lyceum-ink/80">
                  Response shifted to <span className="font-semibold text-lyceum-ink">{trace.resultingState}</span>. {trace.verificationSummary}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-lyceum-muted">Verification traces will appear after at least one adaptive cycle completes.</p>
          )}
        </div>
      </div>

      <div className={`${sectionCardClass} border-lyceum-line bg-[#f5efe3]`}>
        <div className="flex items-center gap-2 text-gray-700">
          <GitBranch size={14} />
          <p className={microLabelClass}>Design-Response Matrix</p>
        </div>
        <div className="mt-3 space-y-2">
          {viewModel.matrixRows.length > 0 ? (
            viewModel.matrixRows.map(row => (
              <div key={`${row.sourceMessageId}-${row.responseMessageId}`} className={ivoryCardClass}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-lyceum-line bg-[#f8f3e8] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-lyceum-muted">
                    {row.transitionLabel}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    row.moveSource === 'instructor_override'
                      ? 'border border-blue-200 bg-blue-50 text-blue-700'
                      : 'border border-gray-200 bg-gray-100 text-gray-600'
                  }`}>
                    {row.moveSource === 'instructor_override' ? 'Instructor Override' : 'Automatic'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-lyceum-ink/80">
                  <span className="font-semibold text-lyceum-ink">{row.appliedMoveLabel}</span> led to a <span className="font-semibold text-lyceum-ink">{row.learnerFunction}</span> response.
                </p>
                <p className={`mt-1 ${bodyMutedClass}`}>
                  CDOI delta: {row.cdoiDelta === null ? 'N/A' : `${row.cdoiDelta > 0 ? '+' : ''}${row.cdoiDelta}`}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-lyceum-muted">Matrix rows will appear after adaptation traces accumulate.</p>
          )}
        </div>
      </div>

      <div className={`${sectionCardClass} border-lyceum-line bg-[#f5efe3]`}>
        <div className="flex items-center gap-2 text-gray-700">
          <AlertTriangle size={14} />
          <p className={microLabelClass}>Supervisory Queue</p>
        </div>
        <div className="mt-3 space-y-2">
          {viewModel.reviewQueue.length > 0 ? (
            viewModel.reviewQueue.map(item => {
              const analysis = learnerAnalysesById.get(item.messageId);
              const predictedMoves = appliedMoveByMessageId.get(item.messageId) || [];

              return (
                <ReviewQueueCard
                  key={item.messageId}
                  item={item}
                  messageText={messageById.get(item.messageId)?.text || ''}
                  predictedState={analysis?.dominantState || null}
                  predictedStrategy={analysis?.dominantStrategy || null}
                  predictedMove={predictedMoves[0] || null}
                  annotation={reasoningAnnotations[item.messageId]}
                  onLogClick={onLogClick}
                  onSaveReasoningAnnotation={onSaveReasoningAnnotation}
                  onClearReasoningAnnotation={onClearReasoningAnnotation}
                />
              );
            })
          ) : (
            <p className="text-xs text-lyceum-muted">No high-risk turns are currently waiting for supervisory review.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default TeacherAnalyticsPanel;
