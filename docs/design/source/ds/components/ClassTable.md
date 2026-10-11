Shows one day's classes. `color` should be a class token, e.g. `var(--class-spine)`.
```jsx
<ClassTable date="Srijeda, 14.10." classes={[{time:'09:00–10:00',title:'Joga za kralježnicu',color:'var(--class-spine)',teacher:'Maja',booked:9,capacity:12}]} />
```

## Props

```ts
/**
 * Day schedule with class colour, teacher and capacity bar (terracotta when full).
 */
export interface ClassItem { time: string; title: string; color: string; teacher: string; booked: number; capacity: number; waitlist?: number; }
export interface ClassTableProps { date?: string; classes: ClassItem[]; compact?: boolean; }
export function ClassTable(props: ClassTableProps): JSX.Element;
```
