import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MetricCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  className?: string;
  to?: string;
}

export function MetricCard({ title, value, icon: Icon, className, to }: MetricCardProps) {
  const body = (
    <div
      className={cn(
        'metric-card transition-shadow',
        to && 'hover:shadow-md hover:border-primary/40 cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-4xl font-bold mt-2">{value}</p>
        </div>
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </div>
  );

  return to ? (
    <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}
