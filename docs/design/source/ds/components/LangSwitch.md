Switches the interface language. Croatian is the default.
```jsx
<LangSwitch value={lang} onChange={setLang} dark />
```

## Props

```ts
/** HR / EN interface language switch. Use dark on the ink sidebar. */
export interface LangSwitchProps { value?: string; onChange?: (lang: string) => void; dark?: boolean; options?: string[]; }
export function LangSwitch(props: LangSwitchProps): JSX.Element;
```
