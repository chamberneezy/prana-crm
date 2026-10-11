// The demo backend is bundled by Vite (through the web app), which provides these import forms.
declare module '*?url' {
  const url: string;
  export default url;
}

declare module '*?raw' {
  const text: string;
  export default text;
}
