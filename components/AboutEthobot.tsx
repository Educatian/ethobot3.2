import React from 'react';
import { ArrowRight, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AboutEthobotProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProjectOverview: () => void;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
}

const AboutEthobot: React.FC<AboutEthobotProps> = ({
  isOpen,
  onClose,
  onOpenProjectOverview,
  onLogClick,
}) => {
  const { language } = useLanguage();
  if (!isOpen) return null;

  const copy =
    language === 'ko'
      ? {
          eyebrow: 'About ETHOBOT',
          title: 'ETHOBOT은 윤리적 딜레마를 더 천천히, 더 넓게, 더 성찰적으로 읽게 돕는 대화형 학습 공간입니다.',
          body: '프로젝트는 AI 윤리 대화를 단순 질의응답이 아니라, 관점 비교와 정당화, 성찰이 일어나는 비구조적 문제해결 과정으로 설계합니다.',
          chips: ['ill-structured problems', 'dilemma dialogue', 'reflective prompting'],
          cta: '프로젝트 개요 보기',
          foot: 'Jonassen의 비구조적 문제해결과 딜레마 기반 교수법이 ETHOBOT 안에서 어떻게 만나는지 한 페이지로 정리했습니다.',
        }
      : {
          eyebrow: 'About ETHOBOT',
          title: 'ETHOBOT is a dialogue space for reading ethical dilemmas more slowly, more widely, and more reflectively.',
          body: 'The project treats AI ethics not as quick-answer recall, but as ill-structured problem solving supported by perspective comparison, justification, and reflective prompting.',
          chips: ['ill-structured problems', 'dilemma dialogue', 'reflective prompting'],
          cta: 'Open project overview',
          foot: 'A one-page overview explains how Jonassen’s account of ill-structured problem solving can coordinate with dilemma-based pedagogy inside ETHOBOT.',
        };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#00181b]/56 p-4 backdrop-blur-sm"
      onClick={() => {
        onLogClick('about-modal-close-overlay', 'div', 'Close About');
        onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-lyceum-line bg-[#fffdf8] text-lyceum-ink shadow-panel"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-lyceum-line bg-[#f4eee2] px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.32em] text-lyceum-muted">{copy.eyebrow}</p>
              <h2 className="mt-3 font-headline text-3xl font-bold leading-tight text-lyceum-ink sm:text-4xl">
                {copy.title}
              </h2>
            </div>
            <button
              id="about-modal-close-button"
              onClick={() => {
                onLogClick('about-modal-close-button', 'button', 'Close');
                onClose();
              }}
              className="rounded-full border border-lyceum-line bg-white p-2 text-lyceum-muted transition hover:text-lyceum-ink"
              title="Close information panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <p className="max-w-2xl text-sm leading-7 text-lyceum-ink-soft sm:text-base">{copy.body}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {copy.chips.map(chip => (
                <span
                  key={chip}
                  className="rounded-full border border-lyceum-line bg-[#fcfaf4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-lyceum-accent"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-lyceum-line bg-lyceum-ink px-6 py-6 text-lyceum-paper sm:px-8 sm:py-8 lg:border-l lg:border-t-0">
            <p className="text-sm leading-7 text-lyceum-paper/78">{copy.foot}</p>
            <button
              type="button"
              onClick={() => {
                onLogClick('about-open-project-overview', 'button', copy.cta);
                onClose();
                onOpenProjectOverview();
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-lyceum-ink transition hover:bg-[#f7f1e4]"
            >
              {copy.cta}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutEthobot;
