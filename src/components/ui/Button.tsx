'use client';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:scale-[0.98] shadow-sm',
  secondary: 'bg-muted-light text-foreground hover:bg-border active:scale-[0.98]',
  ghost: 'text-muted hover:text-foreground hover:bg-muted-light',
  danger: 'bg-destructive text-white hover:bg-red-600 active:scale-[0.98]',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-sm rounded-xl min-w-[44px]',
  lg: 'h-12 px-6 text-base rounded-xl',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 ${variants[variant]} ${sizes[size]} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
