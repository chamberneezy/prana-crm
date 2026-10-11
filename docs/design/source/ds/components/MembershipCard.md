Shows monthly usage of a weekly plan as segments. Visits are counted per month.
```jsx
<MembershipCard plan="2× tjedno" used={5} total={8} renewal="01.11." />
```

## Props

```ts
/**
 * Monthly usage of a weekly membership (1×/2×/3× tjedno ≈ 4/8/12 visits, or unlimited).
 */
export interface MembershipCardProps {
  plan?: string;
  used?: number;
  /** Visits per month; 0 = unlimited. */
  total?: number;
  /** dd.mm. date shown as an amber "Obnova" chip. */
  renewal?: string;
  period?: string;
}
export function MembershipCard(props: MembershipCardProps): JSX.Element;
```
