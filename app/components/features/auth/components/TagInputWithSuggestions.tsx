'use client';

import { useState, KeyboardEvent } from 'react';
import { Input } from '@/app/components/ui/input';
import { X } from 'lucide-react';

interface TagInputWithSuggestionsProps {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  maxTags?: number;
}

export function TagInputWithSuggestions({
  value,
  onChange,
  suggestions,
  placeholder,
  maxTags = 10,
}: TagInputWithSuggestionsProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmedValue = inputValue.trim();

      if (trimmedValue && !value.includes(trimmedValue) && value.length < maxTags) {
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

  const toggleSuggestion = (suggestion: string) => {
    if (value.includes(suggestion)) {
      onChange(value.filter((item) => item !== suggestion));
    } else {
      if (value.length < maxTags) {
        onChange([...value, suggestion]);
      }
    }
  };

  const availableSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center space-x-1 px-3 py-1 bg-primary-main text-white rounded-full text-sm"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-primary-text transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="bg-bg-input border-border-input text-text-heading"
          disabled={value.length >= maxTags}
        />

        <p className="text-xs text-text-muted">
          Press Enter or comma to add a tag
        </p>
      </div>

      {availableSuggestions.length > 0 && (
        <div>
          <p className="text-sm font-medium text-text-body mb-2">
            Quick picks:
          </p>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => toggleSuggestion(suggestion)}
                disabled={value.length >= maxTags}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-secondary-main dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
