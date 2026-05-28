/**
 * AvatarIcon — Displays a user/agent avatar image or initial-based fallback.
 *
 * Reads the avatar URL from localStorage (set via Agent Hub → Avatar section).
 * Falls back to a colored initial circle if no avatar is configured.
 *
 * @module AvatarIcon
 */

import { useState } from 'react';

/** Color palettes for initial-based avatars. */
const COLORS: Record<string, string> = {
  You: 'bg-primary/20 text-primary',
  Durnafal: 'bg-info/20 text-info',
  Leela: 'bg-success/20 text-success',
  default: 'bg-secondary/40 text-muted-foreground',
};

function getAvatarKey(name: string): string {
  return `nerve-avatar-${name}`;
}

interface AvatarIconProps {
  /** Display name used for initial fallback and color selection. */
  name: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'size-6 text-[0.6rem]',
  md: 'size-8 text-[0.733rem]',
  lg: 'size-10 text-sm',
};

/**
 * Load the avatar URL from localStorage.
 */
function loadAvatarUrl(name: string): string {
  try {
    return localStorage.getItem(getAvatarKey(name)) || '';
  } catch { return ''; }
}

/**
 * AvatarIcon component — shows custom avatar or initial fallback.
 */
export function AvatarIcon({ name, size = 'md' }: AvatarIconProps) {
  const [avatarUrl] = useState(() => loadAvatarUrl(name));
  const [imgError, setImgError] = useState(false);
  const initial = name.charAt(0).toUpperCase();
  const colorClass = COLORS[name] || COLORS.default;
  const sizeClass = SIZE_MAP[size];

  if (avatarUrl && !imgError) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden shrink-0 border border-border/30`}>
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-semibold shrink-0 ${colorClass}`}>
      {initial}
    </div>
  );
}
