import React, { useEffect, useMemo, useState } from 'react';
import type { Challenge, KnowledgeSource, Message } from '../types';
import { getChallengeById, getKnowledgeSourceById } from '../services/dataService';
import { useLanguage } from '../contexts/LanguageContext';
import ChallengeCard from './ChallengeCard';
import ChoiceButtons from './ChoiceButtons';
import KnowledgeCard from './KnowledgeCard';
import TypingIndicator from './TypingIndicator';
import { BotIcon, UserIcon } from './icons';

interface MessageProps {
  message: Message;
  isSending?: boolean;
  onSendMessage: (text: string, fromChoiceButton?: boolean) => void | Promise<void>;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
}

interface ChallengeRendererProps {
  challengeId: string;
  onSendMessage: (text: string, fromChoiceButton?: boolean) => void | Promise<void>;
}

const ChallengeRenderer: React.FC<ChallengeRendererProps> = ({ challengeId, onSendMessage }) => {
  const [challenge, setChallenge] = useState<Challenge | null | undefined>(undefined);
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;
    const fetchChallenge = async () => {
      const data = await getChallengeById(challengeId);
      if (isMounted) {
        setChallenge(data ?? null);
      }
    };
    fetchChallenge();
    return () => {
      isMounted = false;
    };
  }, [challengeId]);

  if (challenge === undefined) {
    return <div className="p-2 text-sm">{t('loadingChallenge')}</div>;
  }

  if (!challenge) {
    return <div className="p-2 text-sm text-red-500">{t('challengeLoadError')} {challengeId}</div>;
  }

  return <ChallengeCard challenge={challenge} onSendMessage={onSendMessage} />;
};

interface KnowledgeRendererProps {
  sourceId: string;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
}

const KnowledgeRenderer: React.FC<KnowledgeRendererProps> = ({ sourceId, onLogClick }) => {
  const [source, setSource] = useState<KnowledgeSource | null | undefined>(undefined);
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;
    const fetchSource = async () => {
      const data = await getKnowledgeSourceById(sourceId);
      if (isMounted) {
        setSource(data ?? null);
      }
    };
    fetchSource();
    return () => {
      isMounted = false;
    };
  }, [sourceId]);

  if (source === undefined) {
    return <div className="p-2 text-sm">{t('loadingDeepDive')}</div>;
  }

  if (!source) {
    return <div className="p-2 text-sm text-red-500">{t('deepDiveLoadError')} {sourceId}</div>;
  }

  return <KnowledgeCard source={source} onLogClick={onLogClick} />;
};

const MessageBubble: React.FC<MessageProps> = ({ message, isSending, onSendMessage, onLogClick }) => {
  const isUser = message.sender === 'user';
  const { t } = useLanguage();

  const { mainText, choices } = useMemo(() => {
    const choiceRegex = /\[CHOICE:(.+?)\]/g;
    const extractedChoices = [...message.text.matchAll(choiceRegex)].map(match => match[1]);
    const extractedMainText = message.text.replace(choiceRegex, '').trim();
    return { mainText: extractedMainText, choices: extractedChoices };
  }, [message.text]);

  const renderContent = (text: string) => {
    const parts = text.split(/(\[CHALLENGE:\w+\]|\[KNOWLEDGE:\w+\])/g);

    return parts.map((part, index) => {
      const challengeMatch = part.match(/\[CHALLENGE:(\w+)\]/);
      if (challengeMatch) {
        return (
          <ChallengeRenderer
            key={`${message.id}-c-${index}`}
            challengeId={challengeMatch[1]}
            onSendMessage={onSendMessage}
          />
        );
      }

      const knowledgeMatch = part.match(/\[KNOWLEDGE:(\w+)\]/);
      if (knowledgeMatch) {
        return (
          <KnowledgeRenderer
            key={`${message.id}-k-${index}`}
            sourceId={knowledgeMatch[1]}
            onLogClick={onLogClick}
          />
        );
      }

      let formattedPart = part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formattedPart = formattedPart.replace(/\*(.*?)\*/g, '<em>$1</em>');

      return (
        <span
          key={`${message.id}-t-${index}`}
          dangerouslySetInnerHTML={{ __html: formattedPart.replace(/\n/g, '<br />') }}
        />
      );
    });
  };

  return (
    <div
      className={`flex items-start gap-4 transition-opacity duration-300 ${
        isUser ? 'flex-row-reverse' : ''
      } ${isSending ? 'opacity-60' : 'opacity-100'}`}
    >
      <div
        className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border shadow-sm ${
          isUser
            ? 'border-lyceum-accent/30 bg-lyceum-accent-soft text-lyceum-accent'
            : 'border-lyceum-ink-soft/10 bg-lyceum-ink text-white'
        }`}
      >
        {isUser ? <UserIcon className="h-6 w-6" /> : <BotIcon className="h-6 w-6" />}
      </div>

      <div className={`max-w-[85%] sm:max-w-2xl ${isUser ? 'text-right' : ''}`}>
        <div
          className={`rounded-2xl border p-4 sm:p-[1.1rem] shadow-sm ${
            isUser
              ? 'rounded-tr-md border-lyceum-line bg-[#f3ede0] text-lyceum-ink'
              : 'rounded-tl-md border-lyceum-ink-soft/10 bg-lyceum-ink text-[#f7f2e7]'
          }`}
        >
          {message.sender === 'bot' && message.text === '...' ? (
            <TypingIndicator />
          ) : (
            <div className={`prose prose-sm max-w-none text-[13px] leading-6 text-inherit ${isUser ? '' : 'prose-invert'}`}>
              {renderContent(mainText)}
            </div>
          )}
        </div>

        {choices.length > 0 && !isUser && (
          <ChoiceButtons choices={choices} onSelect={onSendMessage} />
        )}

        <p
          className={`mt-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-lyceum-muted ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {isUser ? t('you') : 'ETHOBOT'} {'\u00b7'} {message.timestamp}
        </p>
      </div>
    </div>
  );
};

export default MessageBubble;
