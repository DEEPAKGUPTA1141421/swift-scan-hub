import { Link } from 'react-router-dom';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  to: string;
  variant?: 'default' | 'primary';
}

export function ActionCard({ title, description, icon: Icon, to, variant = 'default' }: ActionCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'block p-6 rounded-xl border-2 transition-all duration-200',
        'hover:shadow-lg active:scale-[0.99]',
        variant === 'primary' 
          ? 'border-primary bg-primary/5 hover:bg-primary/10' 
          : 'border-border bg-card hover:border-primary/50'
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          'p-4 rounded-xl',
          variant === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
        )}>
          <Icon className="w-8 h-8" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        <ChevronRight className="w-6 h-6 text-muted-foreground" />
      </div>
    </Link>
  );
}
