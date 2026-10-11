A row for the members list. Stack rows inside a Card with padding 0, and they draw their own dividers.
```jsx
<MemberRow name="Ana Horvat" sub="2× tjedno · zadnji dolazak 12.10." note="Kralježnica · L5" status="active" />
```

## Props

```ts
/** One member in a list: avatar, name, plan/last visit, optional health note, status. */
export interface MemberRowProps {
  name: string;
  sub?: string;
  note?: string;
  status?: 'active' | 'expiring' | 'unpaid' | 'frozen' | 'trial';
  statusLabel?: string;
  compact?: boolean;
  onClick?: () => void;
}
export function MemberRow(props: MemberRowProps): JSX.Element;
```
