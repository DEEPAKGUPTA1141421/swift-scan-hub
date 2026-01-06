import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
}

export function PageHeader({ title, subtitle, backTo }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {backTo && (
        <Link 
          to={backTo} 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </Link>
      )}
      <h1 className="text-3xl font-bold">{title}</h1>
      {subtitle && <p className="text-lg text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
