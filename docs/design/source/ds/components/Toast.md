Short confirmation after an action. Keep it to one sentence.
```jsx
<Toast action="Poništi">Ana Horvat je spremljena kao novi član.</Toast>
```

## Props

```ts
import * as React from 'react';
/** Ink confirmation toast with optional action (e.g. Poništi). */
export interface ToastProps { children?: React.ReactNode; action?: string; onAction?: () => void; }
export function Toast(props: ToastProps): JSX.Element;
```
