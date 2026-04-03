import React, { useState } from 'react';
import { ChoiceIcon } from './icons';

interface ChoiceButtonsProps {
  choices: string[];
  onSelect: (choice: string, fromChoiceButton: boolean) => void;
}

const ChoiceButtons: React.FC<ChoiceButtonsProps> = ({ choices, onSelect }) => {
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSelect = (choice: string) => {
    if (isCompleted) return;
    setIsCompleted(true);
    onSelect(choice, true);
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2.5">
      {choices.map((choice, index) => (
        <button
          key={index}
          onClick={() => handleSelect(choice)}
          disabled={isCompleted}
          className={`flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            isCompleted
              ? 'cursor-not-allowed border-lyceum-line bg-[#f1ece0] text-lyceum-muted'
              : 'border-lyceum-line bg-white text-lyceum-ink hover:border-lyceum-accent hover:bg-lyceum-paper-soft hover:text-lyceum-accent'
          }`}
        >
          <ChoiceIcon className="mr-2 h-4 w-4" />
          {choice}
        </button>
      ))}
    </div>
  );
};

export default ChoiceButtons;
