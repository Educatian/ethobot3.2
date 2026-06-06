import React from 'react';
import type { PositionInput, Scenario } from '../../types';
import PositionInputForm from './PositionInputForm';

interface PreFormPositionProps {
  scenario: Scenario;
  onSubmit: (position: PositionInput) => void;
  language?: string;
}

const PreFormPosition: React.FC<PreFormPositionProps> = ({ scenario, onSubmit, language }) => {
  const ko = language === 'ko';
  return (
    <section className="bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-6 max-w-2xl mx-auto shadow-ambient">
      <h2 className="text-2xl font-headline font-semibold mb-1 text-lyceum-ink">
        {ko ? '시작하기 전에' : 'Before we begin'}
      </h2>
      <p className="text-sm text-lyceum-muted mb-5">
        {ko
          ? '잠시 이 딜레마를 천천히 살펴보세요. 그런 다음 지금의 입장을 기록해 두면, 마지막에 다시 비교해 볼 수 있어요.'
          : 'Take a moment with the dilemma. Then record your starting position so we can revisit it at the end.'}
      </p>

      <div className="bg-lyceum-paper-soft border border-lyceum-line rounded p-4 mb-6">
        <h3 className="text-sm font-semibold text-lyceum-ink mb-1 uppercase tracking-wide">{scenario.title}</h3>
        <p className="text-sm text-lyceum-ink/85 leading-relaxed mb-3">{scenario.scenario}</p>
        <p className="text-sm text-lyceum-ink/90">
          <span className="font-semibold">{ko ? '생각해 볼 질문: ' : 'Guiding question: '}</span>
          {scenario.guidingQuestion}
        </p>
      </div>

      <PositionInputForm
        valueOptions={scenario.valueOptions}
        submitLabel={ko ? '대화 시작하기' : 'Start the dialogue'}
        helperText={
          ko
            ? '지금은 직관적으로 판단하셔도 괜찮아요. 그게 자연스러운 거예요. 나중에 다시 돌아올게요.'
            : "Your initial reasoning is intuitive — that's expected. We'll come back to it."
        }
        onSubmit={onSubmit}
        language={language}
      />
    </section>
  );
};

export default PreFormPosition;
