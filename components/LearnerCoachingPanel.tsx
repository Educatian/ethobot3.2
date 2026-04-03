import React, { useState } from 'react';
import { ChevronDown, Compass, Lightbulb, MoveRight } from 'lucide-react';
import type { ReasoningAnalyticsSnapshot } from '../types';
import { createLearnerCoachingViewModel } from '../services/reasoningAnalyticsService';

interface LearnerCoachingPanelProps {
  analytics: ReasoningAnalyticsSnapshot;
  variant?: 'banner' | 'sidebar';
}

const LearnerCoachingPanel: React.FC<LearnerCoachingPanelProps> = ({ analytics, variant = 'banner' }) => {
  const viewModel = createLearnerCoachingViewModel(analytics);
  const [isInsightOpen, setIsInsightOpen] = useState(false);

  if (variant === 'sidebar') {
    return (
      <aside className="flex h-full flex-col border-l border-lyceum-line/70 bg-[#f5f2e8]">
        <div className="border-b border-lyceum-line/70 px-6 py-4">
          <button
            type="button"
            onClick={() => setIsInsightOpen(open => !open)}
            className="flex w-full items-start gap-3 text-left"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-lyceum-accent/20 bg-white text-lyceum-accent shadow-sm">
              <Compass size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.32em] text-lyceum-muted">Ethical Insight</p>
              <h3 className="mt-2 font-headline text-2xl font-bold leading-tight tracking-tight text-lyceum-ink">
                {viewModel.coachingTitle}
              </h3>
              {!isInsightOpen && (
                <p className="mt-2 text-sm text-lyceum-muted">{viewModel.coachingSummary}</p>
              )}
            </div>
            <ChevronDown
              size={18}
              className={`mt-1 flex-shrink-0 text-lyceum-muted transition ${isInsightOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {isInsightOpen && (
            <p className="mt-4 text-sm leading-7 text-lyceum-muted">{viewModel.coachingSummary}</p>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          <div className="rounded-[1.35rem] border border-lyceum-line bg-white/85 p-5 shadow-panel">
            <div className="flex items-center gap-2 text-lyceum-ink">
              <Lightbulb size={14} className="text-lyceum-accent" />
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-lyceum-muted">What To Try Next</p>
            </div>
            <p className="mt-3 text-sm leading-7 text-lyceum-ink">{viewModel.momentumLabel}</p>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-lyceum-accent">{viewModel.opennessLabel}</p>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-lyceum-accent/15 bg-lyceum-paper-soft px-4 py-4">
              <MoveRight size={14} className="mt-0.5 flex-shrink-0 text-lyceum-accent" />
              <p className="text-sm font-medium leading-6 text-lyceum-ink">{viewModel.nextStepLabel}</p>
            </div>
            <p className="mt-4 text-xs leading-6 text-lyceum-muted">{viewModel.encouragement}</p>
          </div>

          <div className="rounded-[1.35rem] border border-lyceum-line bg-[#faf7ef] p-5 shadow-ambient">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.26em] text-lyceum-muted">Reflection Starters</p>
            <div className="mt-4 flex flex-col gap-3">
              {viewModel.reflectionPrompts.map(prompt => (
                <div key={prompt} className="rounded-2xl border border-lyceum-line/80 bg-white px-4 py-3 text-sm leading-6 text-lyceum-ink shadow-sm">
                  {prompt}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <section className="border-b border-lyceum-line/70 bg-[#f5f2e8] px-4 py-5 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-lyceum-accent/20 bg-white text-lyceum-accent shadow-sm">
            <Compass size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.32em] text-lyceum-muted">Ethical Insight</p>
            <h3 className="mt-1 font-headline text-2xl font-bold tracking-tight text-lyceum-ink">{viewModel.coachingTitle}</h3>
            <p className="mt-2 max-w-3xl text-sm text-lyceum-muted">{viewModel.coachingSummary}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="rounded-[1.35rem] border border-lyceum-line bg-white/85 p-5 shadow-panel">
            <div className="flex items-center gap-2 text-lyceum-ink">
              <Lightbulb size={14} className="text-lyceum-accent" />
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-lyceum-muted">What To Try Next</p>
            </div>
            <p className="mt-3 text-sm text-lyceum-ink">{viewModel.momentumLabel}</p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-lyceum-accent">{viewModel.opennessLabel}</p>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-lyceum-accent/15 bg-lyceum-paper-soft px-4 py-4">
              <MoveRight size={14} className="mt-0.5 flex-shrink-0 text-lyceum-accent" />
              <p className="text-sm font-medium text-lyceum-ink">{viewModel.nextStepLabel}</p>
            </div>
            <p className="mt-4 text-xs text-lyceum-muted">{viewModel.encouragement}</p>
          </div>

          <div className="rounded-[1.35rem] border border-lyceum-line bg-[#faf7ef] p-5 shadow-ambient">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.26em] text-lyceum-muted">Reflection Starters</p>
            <div className="mt-4 flex flex-col gap-3">
              {viewModel.reflectionPrompts.map(prompt => (
                <div key={prompt} className="rounded-2xl border border-lyceum-line/80 bg-white px-4 py-3 text-sm text-lyceum-ink shadow-sm">
                  {prompt}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LearnerCoachingPanel;
