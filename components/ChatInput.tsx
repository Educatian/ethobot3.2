import React, { useEffect, useRef, useState } from 'react';
import { SendIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

interface ChatInputProps {
  onSend: (text: string) => void | Promise<void>;
  isLoading: boolean;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
  placeholder?: string;
  sendTitle?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading,
  onLogClick,
  placeholder,
  sendTitle,
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [text]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isLoading) {
      onSend(text);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-lyceum-line/70 bg-lyceum-paper/90 px-4 py-4 backdrop-blur sm:px-8">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-5xl items-end gap-3 sm:gap-5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('inputPlaceholder')}
          rows={3}
          className="min-h-24 max-h-44 flex-1 resize-none rounded-2xl border border-lyceum-line bg-white/90 px-5 py-3 text-sm leading-relaxed text-lyceum-ink shadow-inner outline-none transition focus:border-lyceum-accent focus:ring-2 focus:ring-lyceum-accent/20"
          disabled={isLoading}
        />
        <button
          id="send-message-button"
          type="submit"
          disabled={isLoading || !text.trim()}
          onClick={(e) => onLogClick('send-message-button', 'button', e.currentTarget.textContent)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-lyceum-ink text-white shadow-ambient transition hover:bg-lyceum-ink-soft focus:outline-none focus:ring-2 focus:ring-lyceum-accent/30 focus:ring-offset-2 focus:ring-offset-lyceum-paper disabled:cursor-not-allowed disabled:bg-lyceum-muted"
          title={sendTitle ?? 'Send your message to Ethobot'}
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <SendIcon className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
