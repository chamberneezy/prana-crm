Page title row. The only place in the app where the brand serif appears at page scale.
```jsx
<PageHeader title="Članovi"><Button>Novi član</Button></PageHeader>
```

## Props

```ts
import * as React from 'react';
/** Cinzel page title with right-aligned actions (search, one primary button). */
export interface PageHeaderProps { title: string; children?: React.ReactNode; }
export function PageHeader(props: PageHeaderProps): JSX.Element;
```
