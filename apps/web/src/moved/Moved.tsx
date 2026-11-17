import { useEffect } from 'react';

/**
 * The old preview's address (GitHub Pages) now only forwards to the live studio. The preview kept its data in each
 * browser; nothing is carried over: the studio is entered afresh in the live app, which both owners share.
 */
export function Moved({ to }: { to: string }) {
  const target = to.replace(/\/$/, '') + '/' + location.pathname.slice(import.meta.env.BASE_URL.length).replace(/^\//, '');

  useEffect(() => location.replace(target), [target]);

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16, background: '#F4EFEA', color: '#2A322E', textAlign: 'center' }}>
      <p>
        Prana je preseljena. <a href={target} style={{ color: 'inherit' }}>Otvori pravi studio</a>
      </p>
    </main>
  );
}
