The main app navigation. Default sections are Pregled, Raspored, Članovi, Karte i članarine and Uplate.
```jsx
<Sidebar logoSrc="assets/prana-mark.png" items={[{id:'members',label:'Članovi'}]} active="members" onSelect={setPage} />
```

## Props

```ts
/** Ink app sidebar with logo, sections and language switch. */
export interface SidebarItem { id: string; label: string; }
export interface SidebarProps {
  items: SidebarItem[];
  active?: string;
  onSelect?: (id: string) => void;
  logoSrc?: string;
  lang?: string;
  onLang?: (lang: string) => void;
}
export function Sidebar(props: SidebarProps): JSX.Element;
```
