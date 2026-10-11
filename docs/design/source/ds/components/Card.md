The base surface. Separate cards with hairlines, not shadows.
```jsx
<Card overline="Uplate" padding={20}>…</Card>
```

## Props

```ts
import * as React from 'react';
/** White surface with a hairline border and 10px radius. No shadow. */
export interface CardProps { padding?: number | string; title?: string; overline?: string; style?: React.CSSProperties; children?: React.ReactNode; }
export function Card(props: CardProps): JSX.Element;
```
