Labelled text field with the label above, 8px radius and a sage focus ring. Error messages are written in plain Croatian.
```jsx
<Input label="Ime i prezime" value={name} onChange={e => setName(e.target.value)} />
<Input label="E-mail" error="Unesite ispravnu e-mail adresu." />
<Input label="Molimo navedite" multiline rows={2} />
```

## Props

```ts
import * as React from 'react';
/** Labelled text field (single or multi-line) with focus, error and read-only states. */
export interface InputProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  /** Error message; turns the border terracotta. */
  error?: string;
  hint?: string;
  readOnly?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: string;
  style?: React.CSSProperties;
}
export function Input(props: InputProps): JSX.Element;
```
