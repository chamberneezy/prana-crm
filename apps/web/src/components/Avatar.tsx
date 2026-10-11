import styles from './Avatar.module.css';

/** Initials avatar on mist. 36 in lists, 52 on the profile. */
export interface AvatarProps {
  name?: string;
  size?: number;
}

export function Avatar({ name = '', size = 36 }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div aria-hidden="true" className={styles.avatar} style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
      {initials}
    </div>
  );
}
