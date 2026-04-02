interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <main className={`max-w-2xl mx-auto px-4 pb-24 ${className}`}>
      {children}
    </main>
  );
}
