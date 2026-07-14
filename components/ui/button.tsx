import React from 'react';
import { cn } from '@/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
          {
            // Variants
            'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_2px_10px_rgba(45,90,76,0.2)]': variant === 'primary',
            'bg-secondary text-foreground hover:bg-secondary/80 border border-border/20': variant === 'secondary',
            'border border-border/40 text-foreground bg-transparent hover:bg-secondary/40': variant === 'outline',
            'text-secondary-foreground hover:bg-secondary/50 hover:text-foreground': variant === 'ghost',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_2px_10px_rgba(239,68,68,0.2)]': variant === 'danger',
            // Sizes
            'h-9 px-3 text-sm': size === 'sm',
            'h-11 px-5 text-base': size === 'md',
            'h-13 px-7 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
export default Button;
