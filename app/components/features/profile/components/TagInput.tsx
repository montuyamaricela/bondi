'use client';

import { useState, KeyboardEvent } from 'react';
import { Input } from '@/app/components/ui/input';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmedValue = inputValue.trim();

      if (trimmedValue && !value.includes(trimmedValue)) {
        onChange([...value, trimmedValue]);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center space-x-1 px-3 py-1 bg-primary-main/10 text-primary-main rounded-full text-sm"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-primary-main transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="bg-bg-input border-border-input text-text-heading"
      />

      <p className="text-xs text-text-muted">
        Press Enter or comma to add a tag
      </p>
    </div>
  );
}
