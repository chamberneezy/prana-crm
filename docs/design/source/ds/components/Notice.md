Inline block for things the owner must not miss, such as debts or a member's health note.
```jsx
<Notice title="2 neplaćene uplate">Ukupno 70,00 €.</Notice>
```

## Props

```ts
import * as React from 'react';
/** Blush attention block: unpaid items, health notes. */
export interface NoticeProps { title?: string; children?: React.ReactNode; }
export function Notice(props: NoticeProps): JSX.Element;
```
