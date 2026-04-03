import React from 'react';
import type { KnowledgeSource } from '../types';
import { BookIcon, LinkIcon, YouTubeIcon, BlogIcon } from './icons';

interface KnowledgeCardProps {
  source: KnowledgeSource;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
}

const KnowledgeCard: React.FC<KnowledgeCardProps> = ({ source, onLogClick }) => {
  return (
    <div className="mb-2 mt-5 rounded-[1.5rem] border border-lyceum-line bg-[#fbf7ef] p-5 text-lyceum-ink shadow-sm">
      <div className="mb-4 flex items-center">
        <BookIcon className="mr-3 h-6 w-6 text-lyceum-accent" />
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-lyceum-accent">Resource Library</p>
          <h4 className="font-headline text-2xl font-bold tracking-tight text-lyceum-ink">{source.title}</h4>
        </div>
      </div>
      <p className="mb-4 text-sm leading-7 text-lyceum-ink">{source.summary}</p>
      <div className="flex flex-wrap gap-2">
        <a
          id={`knowledge-link-primary-${source.id}`}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => onLogClick(`knowledge-link-primary-${source.id}`, 'a', e.currentTarget.textContent)}
          className="flex items-center rounded-full border border-lyceum-line bg-white px-3 py-1.5 text-sm text-lyceum-ink transition-colors hover:border-lyceum-accent hover:bg-lyceum-paper-soft hover:text-lyceum-accent"
          title="Open the primary source document in a new tab"
        >
          <LinkIcon className="mr-2 h-4 w-4" /> Primary Source
        </a>
        {source.youtubeUrl && (
          <a
            id={`knowledge-link-youtube-${source.id}`}
            href={source.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => onLogClick(`knowledge-link-youtube-${source.id}`, 'a', e.currentTarget.textContent)}
            className="flex items-center rounded-full border border-lyceum-line bg-white px-3 py-1.5 text-sm text-lyceum-ink transition-colors hover:border-lyceum-accent hover:bg-lyceum-paper-soft hover:text-lyceum-accent"
            title="Watch the related video on YouTube"
          >
            <YouTubeIcon className="mr-2 h-4 w-4" /> Watch on YouTube
          </a>
        )}
        {source.blogUrl && (
          <a
            id={`knowledge-link-blog-${source.id}`}
            href={source.blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => onLogClick(`knowledge-link-blog-${source.id}`, 'a', e.currentTarget.textContent)}
            className="flex items-center rounded-full border border-lyceum-line bg-white px-3 py-1.5 text-sm text-lyceum-ink transition-colors hover:border-lyceum-accent hover:bg-lyceum-paper-soft hover:text-lyceum-accent"
            title="Read more about this in the official blog post"
          >
            <BlogIcon className="mr-2 h-4 w-4" /> Read Blog Post
          </a>
        )}
      </div>
    </div>
  );
};

export default KnowledgeCard;
