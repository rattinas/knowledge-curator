const variants = {
  youtube: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  arxiv: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  podcast: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  blog: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  news: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  default: 'bg-primary-light text-primary',
} as const;

interface BadgeProps {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
