import React, { useMemo, useState } from 'react';
import type { PositionInput, PrePostDelta, Scenario } from '../../types';
import { computePrePostDelta, summarizeDelta } from '../../services/stancePrePost';
import PositionInputForm from './PositionInputForm';

interface PostFormPositionProps {
  scenario: Scenario;
  initialPosition: PositionInput;
  onSubmit: (position: PositionInput, delta: PrePostDelta, reflection: string) => void;
  language?: string;
}

const stanceKo: Record<string, string> = {
  support: '찬성',
  oppose: '반대',
  unsure: '잘 모르겠음',
};

const PostFormPosition: React.FC<PostFormPositionProps> = ({
  scenario,
  initialPosition,
  onSubmit,
  language,
}) => {
  const ko = language === 'ko';
  const stanceText = (s: string) => (ko ? stanceKo[s] ?? s : s.toUpperCase());
  const [closing, setClosing] = useState<PositionInput | null>(null);
  const [reflection, setReflection] = useState('');

  const delta = useMemo(
    () => (closing ? computePrePostDelta(initialPosition, closing) : null),
    [closing, initialPosition]
  );

  const handleSubmit = (position: PositionInput) => {
    setClosing(position);
  };

  const handleConfirm = () => {
    if (closing && delta) onSubmit(closing, delta, reflection.trim());
  };

  return (
    <section className="bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-6 max-w-2xl mx-auto shadow-ambient">
      <h2 className="text-2xl font-headline font-semibold mb-1 text-lyceum-ink">
        {ko ? '지금은 어떻게 생각하세요?' : 'Where do you stand now?'}
      </h2>
      <p className="text-sm text-lyceum-muted mb-5">
        {ko
          ? '대화를 마친 뒤, 같은 질문을 다시 드려요. 천천히 생각해 보세요. 입장이 바뀌어도 괜찮고, 그대로여도 괜찮아요.'
          : 'Same questions, after the conversation. Take your time; shifts are fine, and so is staying put.'}
      </p>

      {!closing ? (
        <PositionInputForm
          valueOptions={scenario.valueOptions}
          submitLabel={ko ? '최종 입장 기록하기' : 'Record my closing position'}
          helperText={
            ko
              ? `처음 입장과 비교해 보세요: ${stanceText(initialPosition.stance)}, 확신도 ${initialPosition.confidence}%.`
              : `Compare to where you started: ${initialPosition.stance.toUpperCase()} at ${initialPosition.confidence}%.`
          }
          onSubmit={handleSubmit}
          language={language}
        />
      ) : (
        <div className="space-y-4">
          <h3 className="font-semibold text-lyceum-ink uppercase tracking-wide text-xs">
            {ko ? '대화 전 / 후 비교' : 'Pre / Post comparison'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-lyceum-line bg-lyceum-paper-soft p-4">
              <p className="text-[11px] uppercase tracking-wide text-lyceum-muted">{ko ? '입장' : 'Stance'}</p>
              <p className="mt-1 text-sm font-semibold text-lyceum-ink">
                {delta ? `${stanceText(delta.stanceFrom)} → ${stanceText(delta.stanceTo)}` : (ko ? '대기 중' : 'pending')}
              </p>
            </div>
            <div className="rounded border border-lyceum-line bg-lyceum-paper-soft p-4">
              <p className="text-[11px] uppercase tracking-wide text-lyceum-muted">{ko ? '확신도' : 'Confidence'}</p>
              <p className="mt-1 text-sm font-semibold text-lyceum-ink">
                {delta
                  ? delta.confidenceDelta === 0
                    ? (ko ? '변화 없음' : 'no change')
                    : ko
                    ? `${Math.abs(delta.confidenceDelta)}포인트 ${delta.confidenceDelta > 0 ? '상승' : '하락'}`
                    : `${Math.abs(delta.confidenceDelta)} point ${delta.confidenceDelta > 0 ? 'increase' : 'decrease'}`
                  : (ko ? '대기 중' : 'pending')}
              </p>
            </div>
            <div className="rounded border border-lyceum-line bg-lyceum-paper-soft p-4">
              <p className="text-[11px] uppercase tracking-wide text-lyceum-muted">{ko ? '바뀐 가치' : 'Values changed'}</p>
              <p className="mt-1 text-sm font-semibold text-lyceum-ink">
                {(delta?.valuesAdded.length ?? 0) + (delta?.valuesRemoved.length ?? 0)}
              </p>
            </div>
          </div>
          <div className="rounded border border-lyceum-line bg-lyceum-paper-soft p-4 text-sm">
            <h3 className="font-semibold text-lyceum-ink mb-2 uppercase tracking-wide text-xs">{ko ? '무엇이 바뀌었나요?' : 'What changed?'}</h3>
            <p className="text-lyceum-ink/85">{delta && summarizeDelta(delta, language)}</p>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-lyceum-ink uppercase tracking-wide">
              {ko ? '간단한 돌아보기' : 'Brief reflection'}
            </span>
            <textarea
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              rows={3}
              className="mt-2 w-full resize-y rounded border border-lyceum-line bg-white px-3 py-2 text-sm leading-relaxed text-lyceum-ink outline-none focus:border-alabama-crimson focus:ring-2 focus:ring-alabama-crimson/20"
              placeholder={
                ko
                  ? '한두 문장으로, 생각이 어떻게 바뀌었거나 그대로였는지 적어 주세요.'
                  : 'In one or two sentences, what changed or stayed the same in your thinking?'
              }
            />
          </label>
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3 rounded bg-alabama-crimson text-white text-sm font-semibold tracking-wide hover:bg-crimson-dark shadow-ambient transition-colors"
          >
            {ko ? '세션 마치기' : 'Finish session'}
          </button>
          <button
            type="button"
            onClick={() => setClosing(null)}
            className="w-full py-2.5 rounded border border-lyceum-line text-sm text-lyceum-ink hover:bg-lyceum-paper-deep transition-colors"
          >
            {ko ? '최종 입장 다시 쓰기' : 'Edit my closing position'}
          </button>
        </div>
      )}
    </section>
  );
};

export default PostFormPosition;
