interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className = '', onClick, hover = false }: CardProps) {
  const base = 'bg-card rounded-2xl border border-border overflow-hidden';
  const hoverClass = hover ? 'hover:border-primary/30 hover:shadow-md transition-all cursor-pointer' : '';

  return onClick ? (
    <button onClick={onClick} className={`${base} ${hoverClass} w-full text-left ${className}`}>
      {children}
    </button>
  ) : (
    <div className={`${base} ${className}`}>
      {children}
    </div>
  );
}
