import { avatarColor, initial } from '@/lib/avatar';

export function Avatar({ id, name, size = 'md' }: { id: number; name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${size === 'sm' ? 'size-7 text-xs' : 'size-9 text-sm'}`}
      style={{ background: avatarColor(id) }}
    >
      {initial(name)}
    </span>
  );
}
