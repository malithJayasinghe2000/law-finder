'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Heading2, List, Link as LinkIcon, ImagePlus, Eye, Edit3 } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  onImageUpload?: () => void;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your content here... (Markdown supported)',
  minHeight = '300px',
  onImageUpload,
}: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = document.getElementById('md-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const replacement = before + (selected || 'text') + after;
    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    // Set cursor position after insert
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + before.length + (selected || 'text').length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const tools = [
    { icon: Bold, label: 'Bold', action: () => insertMarkdown('**', '**') },
    { icon: Italic, label: 'Italic', action: () => insertMarkdown('*', '*') },
    { icon: Heading2, label: 'Heading', action: () => insertMarkdown('\n## ') },
    { icon: List, label: 'List', action: () => insertMarkdown('\n- ') },
    { icon: LinkIcon, label: 'Link', action: () => insertMarkdown('[', '](url)') },
  ];

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-2 py-1.5 bg-muted/30">
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => (
            <button
              key={tool.label}
              onClick={tool.action}
              title={tool.label}
              type="button"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <tool.icon className="h-4 w-4" />
            </button>
          ))}
          {onImageUpload && (
            <button
              onClick={onImageUpload}
              title="Insert Image"
              type="button"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPreview(false)}
            className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              !isPreview ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" /> Write
          </button>
          <button
            onClick={() => setIsPreview(true)}
            className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              isPreview ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      {isPreview ? (
        <div
          className="p-4 prose prose-neutral max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground/80"
          style={{ minHeight }}
        >
          {value ? (
            <div className="whitespace-pre-wrap">{value}</div>
          ) : (
            <p className="text-muted-foreground italic">Nothing to preview</p>
          )}
        </div>
      ) : (
        <textarea
          id="md-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-4 text-sm font-mono bg-transparent resize-y focus:outline-none"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}
