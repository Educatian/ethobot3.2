
import React, { useRef, useEffect, useMemo } from 'react';
import type { Message as MessageType } from '../types';
import Message from './Message';
import ChatInput from './ChatInput';

interface ChatWindowProps {
  messages: MessageType[];
  isLoading: boolean;
  onSendMessage: (text: string, fromChoiceButton?: boolean) => void | Promise<void>;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading, onSendMessage, onLogClick }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const lastUserMessageIndex = useMemo(() =>
    messages.map(m => m.sender).lastIndexOf('user'),
    [messages]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-lyceum-paper">
      <div
        id="chat-messages"
        className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12"
      >
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="border-t border-lyceum-line/70 pt-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.34em] text-lyceum-muted">
              Deepening Inquiry
            </p>
          </div>
          {messages.map((msg, index) => (
            <Message
              key={msg.id}
              message={msg}
              isSending={isLoading && msg.sender === 'user' && index === lastUserMessageIndex}
              onSendMessage={onSendMessage}
              onLogClick={onLogClick}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput onSend={onSendMessage} isLoading={isLoading} onLogClick={onLogClick} />
    </div>
  );
};

export default ChatWindow;
