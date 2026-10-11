The new member form, matching the studio's paper upisnica field for field. Saving requires the accuracy consent. E-mail news is a separate opt-in (GDPR).
```jsx
<UpisnicaForm onChange={setDraft} onSave={m => addMember(m)} onCancel={close} />
```
Pair it with `<MemberProfile member={draft} />` for a live preview.

## Props

```ts
/**
 * The studio's paper enrolment form (upisnica): details, student flag, plan, health note, two consents, place/date, signature.
 */
export interface UpisnicaValue {
  name: string; email: string; phone: string; dob: string;
  student: boolean; plan: '1x' | '2x' | '3x' | 'unl';
  health: boolean; healthText: string; consent: boolean; news: boolean;
}
export interface UpisnicaFormProps {
  initial?: Partial<UpisnicaValue>;
  place?: string;
  date?: string;
  onChange?: (v: UpisnicaValue) => void;
  /** Only fires when the accuracy consent is ticked and a name is given. */
  onSave?: (v: UpisnicaValue) => void;
  onCancel?: () => void;
}
export function UpisnicaForm(props: UpisnicaFormProps): JSX.Element;
```
