The member's profile card, filled from the upisnica. The health note is shown in blush because teachers must see it.
```jsx
<MemberProfile member={{ name:'Ana Horvat', plan:'2x', student:true, health:true, healthText:'Hernija L5', consent:true }} onEdit={edit} />
```

## Props

```ts
import type { UpisnicaValue } from './UpisnicaForm';
/**
 * Member profile built from the upisnica: plan, student flag, contacts with age, highlighted health note, consents.
 */
export interface MemberProfileProps {
  member: Partial<UpisnicaValue>;
  status?: 'active' | 'expiring' | 'unpaid' | 'frozen' | 'trial';
  since?: string;
  onEdit?: () => void;
}
export function MemberProfile(props: MemberProfileProps): JSX.Element;
```
