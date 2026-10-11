Shows membership or payment state: active = sage, expiring = amber, unpaid = blush/terracotta, frozen = stone, trial = dashed outline.
```jsx
<StatusChip status="expiring">Ističe za 3 dana</StatusChip>
```

## Props

```ts
import * as React from 'react';
/** Membership / payment status chip with a dot. */
export interface StatusChipProps {
  status?: 'active' | 'expiring' | 'unpaid' | 'frozen' | 'trial';
  /** Override the default label, e.g. "Ističe za 3 dana". */
  children?: React.ReactNode;
}
export function StatusChip(props: StatusChipProps): JSX.Element;
```
