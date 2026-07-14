'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/utils/cn';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-border/50 bg-input px-4 py-2 text-base text-left placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/60 transition-all duration-200"
      >
        <span className={cn('block truncate', !selectedOption && 'text-muted-foreground/60')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn('h-5 w-5 text-muted-foreground/80 transition-transform duration-200', {
            'rotate-180': isOpen,
          })}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-border bg-card p-1 shadow-lg focus:outline-none"
          >
            {options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No options found.</div>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'relative flex w-full cursor-default select-none items-center rounded-lg py-2.5 pl-3 pr-9 text-left text-base text-foreground/90 hover:bg-secondary/40 focus:bg-secondary/40 focus:outline-none transition-all duration-150',
                      {
                        'bg-secondary/55 text-foreground font-medium': isSelected,
                      }
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="block truncate">{option.label}</span>
                      {option.description && (
                        <span className="block text-xs text-muted-foreground/80 mt-0.5">
                          {option.description}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-primary">
                        <Check className="h-5 w-5" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Select;
