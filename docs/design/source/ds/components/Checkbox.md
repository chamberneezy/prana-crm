Checkbox for consents and toggles in forms. Ticked uses sage deep. Use `invalid` when a required box is missed.
```jsx
<Checkbox checked={c} onChange={setC} required>Potvrđujem da su navedeni podaci točni.</Checkbox>
```

## Props

```ts
import * as React from 'react';
/** Consent-style checkbox with a wrapping label. */
export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Appends "Obavezno." to the label. */
  required?: boolean;
  /** Required but not ticked: terracotta border + blush ring. */
  invalid?: boolean;
  children?: React.ReactNode;
}
export function Checkbox(props: CheckboxProps): JSX.Element;
```
