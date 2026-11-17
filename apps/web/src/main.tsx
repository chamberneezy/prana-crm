import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';

const root = createRoot(document.getElementById('root')!);
const movedTo = import.meta.env.VITE_MOVED_TO;

if (movedTo) {
  // The old preview: send what was entered in this browser, then forward to the live studio.
  const { Moved } = await import('./moved/Moved');
  root.render(<Moved to={movedTo} />);
} else {
  const { App } = await import('./app/App');
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
