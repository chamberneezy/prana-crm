Shown when a list is empty. Tell the owner what will appear here and how to start.
```jsx
<EmptyState title="Još nema uplata" action={<Button variant="secondary" size="sm">Prodaj kartu</Button>}>Kad prodate prvu kartu, ovdje će se pojaviti račun.</EmptyState>
```

## Props

```ts
import * as React from 'react';
/** Calm empty state: Cinzel title, one line of guidance, optional action. */
export interface EmptyStateProps { title: string; children?: React.ReactNode; action?: React.ReactNode; }
export function EmptyState(props: EmptyStateProps): JSX.Element;
```
