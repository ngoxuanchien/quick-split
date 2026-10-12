// hex (not Tailwind classes) so the PNG route can use the same colors
export const AVATAR_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];

export const avatarColor = (id: number) => AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];

export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
