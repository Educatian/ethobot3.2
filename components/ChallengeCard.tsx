
import React, { useState } from 'react';
import type { Challenge } from '../types';
import { DilemmaIcon, CheckCircleIcon } from './icons';

interface ChallengeCardProps {
  challenge: Challenge;
  onSendMessage: (text: string, fromChoiceButton: boolean) => void | Promise<void>;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onSendMessage }) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const isCompleted = selectedOption !== null;

  const handleClick = (index: number) => {
    if (isCompleted) return;

    setSelectedOption(index);
    onSendMessage(challenge.options[index].text, true);
  };

  const getButtonClass = (index: number) => {
    const baseClass = 'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors';

    if (!isCompleted) {
      return `${baseClass} border-lyceum-line bg-white text-lyceum-ink hover:border-lyceum-accent hover:bg-lyceum-paper-soft`;
    }

    if (selectedOption === index) {
      return `${baseClass} cursor-not-allowed border-lyceum-accent bg-lyceum-accent-soft ring-2 ring-lyceum-accent/20`;
    }

    return `${baseClass} cursor-not-allowed border-lyceum-line bg-[#f3efe6] text-lyceum-muted`;
  };

  return (
    <div className="mb-2 mt-5 rounded-[1.5rem] border border-lyceum-accent/20 bg-[#fff6ee] p-5 text-lyceum-ink shadow-sm">
      <div className="mb-4 flex items-center">
        <DilemmaIcon className="mr-3 h-6 w-6 text-lyceum-accent" />
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-lyceum-accent">{challenge.type}</p>
          <h4 className="font-headline text-2xl font-bold tracking-tight text-lyceum-ink">{challenge.title}</h4>
        </div>
      </div>
      <p className="mb-4 text-sm leading-7 text-lyceum-ink">{challenge.description}</p>
      <div className="flex flex-col space-y-2">
        {challenge.options.map((option, index) => (
          <div key={index}>
            <button
              onClick={() => handleClick(index)}
              disabled={isCompleted}
              className={getButtonClass(index)}
              title={isCompleted ? "You have already submitted a response" : "Select this option to submit your response"}
            >
              <span>{option.text}</span>
              {selectedOption === index && <CheckCircleIcon className="h-5 w-5 text-lyceum-accent" />}
            </button>
            {selectedOption === index && option.feedback && (
              <div className="mt-[-1px] rounded-b-2xl border-b border-l border-r border-lyceum-accent/35 bg-white px-4 pb-4 pt-4 text-sm text-lyceum-ink">
                <p className="font-semibold text-lyceum-accent">Feedback</p>
                <p className="mt-1">{option.feedback}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChallengeCard;
