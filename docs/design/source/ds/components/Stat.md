A metric with a small label above a 24px tabular number.
```jsx
<Stat label="Aktivni" value={84} /><Stat label="Dugovanja" value="105 €" attention />
```

## Props

```ts
/** Label + tabular metric. attention turns it clay (debts). */
export interface StatProps { label: string; value: string | number; attention?: boolean; }
export function Stat(props: StatProps): JSX.Element;
```
