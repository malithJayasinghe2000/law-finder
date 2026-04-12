'use client';

import { useState } from 'react';
import { ArrowBigUp, ArrowBigDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoteButtonsProps {
  score: number;
  userVote: 'UPVOTE' | 'DOWNVOTE' | null;
  onVote: (type: 'UPVOTE' | 'DOWNVOTE') => Promise<void>;
  orientation?: 'vertical' | 'horizontal';
  size?: 'sm' | 'md';
}

export default function VoteButtons({
  score,
  userVote,
  onVote,
  orientation = 'vertical',
  size = 'md',
}: VoteButtonsProps) {
  const [currentVote, setCurrentVote] = useState(userVote);
  const [currentScore, setCurrentScore] = useState(score);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (type: 'UPVOTE' | 'DOWNVOTE') => {
    if (isVoting) return;
    setIsVoting(true);

    // Optimistic update
    const prevVote = currentVote;
    const prevScore = currentScore;

    if (currentVote === type) {
      // Toggle off
      setCurrentVote(null);
      setCurrentScore(currentScore + (type === 'UPVOTE' ? -1 : 1));
    } else if (currentVote) {
      // Switch vote
      setCurrentVote(type);
      setCurrentScore(currentScore + (type === 'UPVOTE' ? 2 : -2));
    } else {
      // New vote
      setCurrentVote(type);
      setCurrentScore(currentScore + (type === 'UPVOTE' ? 1 : -1));
    }

    try {
      await onVote(type);
    } catch {
      // Revert on error
      setCurrentVote(prevVote);
      setCurrentScore(prevScore);
    } finally {
      setIsVoting(false);
    }
  };

  const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        isVertical ? 'flex-col' : 'flex-row'
      )}
    >
      <button
        onClick={() => handleVote('UPVOTE')}
        disabled={isVoting}
        className={cn(
          'p-1 rounded-md transition-all duration-200 hover:bg-primary/10',
          currentVote === 'UPVOTE'
            ? 'text-primary scale-110'
            : 'text-muted-foreground hover:text-primary'
        )}
        aria-label="Upvote"
      >
        <ArrowBigUp
          className={cn(iconSize, currentVote === 'UPVOTE' && 'fill-current')}
        />
      </button>
      <span
        className={cn(
          'font-bold text-sm tabular-nums min-w-[2ch] text-center transition-colors',
          currentVote === 'UPVOTE' && 'text-primary',
          currentVote === 'DOWNVOTE' && 'text-red-500',
          !currentVote && 'text-foreground'
        )}
      >
        {currentScore}
      </span>
      <button
        onClick={() => handleVote('DOWNVOTE')}
        disabled={isVoting}
        className={cn(
          'p-1 rounded-md transition-all duration-200 hover:bg-red-500/10',
          currentVote === 'DOWNVOTE'
            ? 'text-red-500 scale-110'
            : 'text-muted-foreground hover:text-red-500'
        )}
        aria-label="Downvote"
      >
        <ArrowBigDown
          className={cn(iconSize, currentVote === 'DOWNVOTE' && 'fill-current')}
        />
      </button>
    </div>
  );
}
