import { LucideIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <Icon className="mb-4 h-16 w-16 text-text-muted" />
      <h3 className="mb-2 text-lg font-semibold text-text-heading">{title}</h3>
      <p className="mb-6 max-w-sm text-text-muted">{description}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
