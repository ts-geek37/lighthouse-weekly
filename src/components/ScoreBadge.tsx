interface ScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

const scoreToneClass = (score: number | null): string => {
  if (score === null) return 'bg-gray-100 text-gray-500';
  if (score >= 90) return 'bg-emerald-100 text-emerald-800';
  if (score >= 50) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
};

const sizeClass: Record<NonNullable<ScoreBadgeProps['size']>, string> = {
  sm: 'min-w-[38px] px-2 py-1 text-xs',
  md: 'min-w-12 px-2.5 py-1 text-base',
  lg: 'min-w-16 px-4 py-2 text-2xl',
};

export const ScoreBadge = ({ score, size = 'md' }: ScoreBadgeProps) => {
  const display = score !== null ? Math.round(score) : null;

  return (
    <span className={`inline-flex box-border items-center justify-center rounded-md font-bold leading-none ${scoreToneClass(score)} ${sizeClass[size]}`}>
      {display !== null ? display : 'N/A'}
    </span>
  );
};
