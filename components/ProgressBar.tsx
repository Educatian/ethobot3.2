
import React from 'react';
import { ProblemStage } from '../types';
import { STAGES } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface ProgressBarProps {
  currentStage: ProblemStage;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStage }) => {
  const currentIndex = STAGES.indexOf(currentStage);
  const { t } = useLanguage();

  return (
    <div className="min-w-[220px]">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">
        {t('learningStage')}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <h3 className="font-headline text-lg font-bold tracking-tight text-lyceum-ink">
          {currentStage}
        </h3>
        <span className="rounded-full bg-lyceum-accent-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-lyceum-accent">
          {currentIndex + 1}/{STAGES.length}
        </span>
      </div>
      <div className="mt-3 flex space-x-2">
        {STAGES.map((stage, index) => (
          <div key={stage} className="flex-1 h-1.5 rounded-full bg-lyceum-line/70">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                index <= currentIndex ? 'bg-lyceum-accent' : 'bg-transparent'
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;
