'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Flag, X } from 'lucide-react';

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, description?: string) => Promise<void>;
  contentType: 'post' | 'comment';
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'misinformation', label: 'Misinformation or false legal advice' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'off-topic', label: 'Off-topic or irrelevant' },
  { value: 'other', label: 'Other' },
];

export default function ReportDialog({ isOpen, onClose, onSubmit, contentType }: ReportDialogProps) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await onSubmit(reason, description || undefined);
      setReason('');
      setDescription('');
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-background border rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Flag className="h-4 w-4 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold">Report {contentType}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Help us understand what&apos;s wrong with this {contentType}. Your report will be reviewed by our team.
        </p>

        <div className="space-y-2 mb-4">
          {REPORT_REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                reason === r.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/30'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={(e) => setReason(e.target.value)}
                className="accent-primary"
              />
              <span className="text-sm">{r.label}</span>
            </label>
          ))}
        </div>

        {reason === 'other' && (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please describe the issue..."
            className="w-full p-3 text-sm border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
            rows={3}
          />
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </div>
    </div>
  );
}
