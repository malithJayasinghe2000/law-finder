/**
 * An attorney's photo, or their initials when they have not uploaded one.
 *
 * Never a stock photo. Every attorney without a photo used to show the same
 * Unsplash model, on their own page and their firm's page — a stranger's face
 * presented as theirs.
 */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AttorneyPhoto({
  src,
  name,
  className = '',
  initialsClassName = 'text-sm',
}: {
  src: string | null | undefined;
  name: string;
  className?: string;
  initialsClassName?: string;
}) {
  if (src) {
    return <img src={src} alt={name} className={`object-cover ${className}`} />;
  }
  return (
    <div
      role="img"
      aria-label={name}
      className={`flex items-center justify-center bg-neutral-100 font-bold text-neutral-500 ${className}`}
    >
      <span className={initialsClassName} aria-hidden="true">
        {initialsOf(name)}
      </span>
    </div>
  );
}
