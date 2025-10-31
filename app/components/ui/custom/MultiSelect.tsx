'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, X, Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select options',
  maxSelections,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
    } else {
      if (maxSelections && value.length >= maxSelections) {
        return;
      }
      onChange([...value, option]);
    }
  };

  const removeOption = (option: string) => {
    onChange(value.filter((item) => item !== option));
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchQuery('');
    }
  };

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className='space-y-2.5'>
      {/* Selected items */}
      {value.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {value.map((item) => (
            <span
              key={item}
              className='inline-flex items-center space-x-1 px-3 py-1 bg-primary-main/10 text-primary-main rounded-full text-sm dark:text-primary-text dark:bg-text-muted/10'
            >
              <span>{item}</span>
              <button
                type='button'
                onClick={() => removeOption(item)}
                className='hover:text-primary-main transition-colors'
              >
                <X className='h-3 w-3' />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown toggle */}
      <div className='relative'>
        <Button
          type='button'
          variant='outline'
          onClick={() => handleOpenChange(!isOpen)}
          className='w-full justify-start text-left font-normal bg-bg-input border-border-input text-text-heading'
        >
          {value.length === 0 ? placeholder : `${value.length} selected`}
        </Button>

        {/* Dropdown menu */}
        {isOpen && (
          <>
            <div
              className='fixed inset-0 z-10'
              onClick={() => handleOpenChange(false)}
            />
            <div className='absolute z-20 w-full mt-1 bg-bg-card border border-border-main rounded-lg shadow-lg'>
              {/* Search input */}
              <div className='p-2 border-b border-border-main sticky top-0 bg-bg-card'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted' />
                  <Input
                    ref={searchInputRef}
                    type='text'
                    placeholder='Search...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-9 bg-bg-input  text-text-heading'
                  />
                </div>
              </div>

              {/* Options list */}
              <div className='max-h-60 overflow-y-auto custom-scrollbar'>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => {
                    const isSelected = value.includes(option);
                    const isDisabled =
                      maxSelections &&
                      value.length >= maxSelections &&
                      !isSelected;

                    return (
                      <button
                        key={option}
                        type='button'
                        onClick={() => toggleOption(option)}
                        disabled={!!isDisabled}
                        className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-primary-main/5 dark:bg-text-muted/10'
                            : ''
                        }`}
                      >
                        <span className='text-text-heading'>{option}</span>
                        {isSelected && (
                          <Check className='h-4 w-4 text-primary-main dark:text-primary-text' />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className='px-4 py-8 text-center text-text-muted'>
                    No results found
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {maxSelections && (
        <p className='text-xs text-text-muted'>
          Maximum {maxSelections} selections
        </p>
      )}
    </div>
  );
}
