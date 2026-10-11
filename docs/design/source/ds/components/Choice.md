Single-select choice. Use it inline for NE/DA questions, or as a grid of cards for the membership plan picker.
```jsx
<Choice value={student} onChange={setStudent} options={[{value:false,label:'NE'},{value:true,label:'DA'}]} />
<Choice layout="grid" columns={2} value={plan} onChange={setPlan}
  options={[{value:'1x',label:'1× tjedno',sub:'≈ 4 dolaska mjesečno'}, …]} />
```

## Props

```ts
/** Single-select choice: inline yes/no buttons, or a grid of option cards (e.g. membership plans). */
export interface ChoiceOption { value: string | number | boolean; label: string; sub?: string; }
export interface ChoiceProps {
  options: ChoiceOption[];
  value?: string | number | boolean;
  onChange?: (value: string | number | boolean) => void;
  layout?: 'inline' | 'grid';
  columns?: number;
}
export function Choice(props: ChoiceProps): JSX.Element;
```
