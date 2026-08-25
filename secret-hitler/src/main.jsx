import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted so the app has no network dependency at all — a webfont fetched
// from a CDN is one more thing that fails on a phone with no signal.
//
// Latin subsets only: the full packages ship cyrillic, greek and vietnamese
// too, which quadruples what a phone has to download before the game is
// playable offline. Add a subset here if the roster needs one.
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/oswald/latin-400.css';
import '@fontsource/oswald/latin-500.css';

import './index.css';
import App from './App.jsx';
import UpdatePrompt from './components/UpdatePrompt.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* Mounted here rather than inside App: it talks to the service worker
        through a Vite virtual module, which only exists under the bundler. */}
    <UpdatePrompt />
  </StrictMode>,
);
