Member initials in a mist circle. Use 36px in lists and 52px on the profile.
```jsx
<Avatar name="Ana Horvat" size={52} />
```

## Props

```ts
/** Initials avatar on mist. */
export interface AvatarProps { name?: string; size?: number; }
export function Avatar(props: AvatarProps): JSX.Element;
```
