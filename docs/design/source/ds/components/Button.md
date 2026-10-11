Action button. Use `primary` (ink) for the one main action per page, `secondary` for alternatives, `ghost` for cancel, and `attention` (terracotta) only for payment or destructive actions.
```jsx
<Button>Novi član</Button>
<Button variant="secondary">Prodaj kartu</Button>
<Button variant="ghost">Odustani</Button>
<Button variant="attention">Označi plaćeno</Button>
```
Props: variant, size ("md" 40px | "sm" 32px), disabled (40% opacity).

## Props

```ts
import * as React from 'react';
/**
 * Prana action button. One primary per view; attention only for money/destructive actions.
 */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'attention';
  size?: 'md' | 'sm';
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export function Button(props: ButtonProps): JSX.Element;
```
