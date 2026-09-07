import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

// The webview's own context menu and drag-to-navigate feel wrong in a native
// window, so suppress them.
window.addEventListener('contextmenu', (e) => {
  const target = e.target as HTMLElement;
  const editable = target.closest('input, textarea, [contenteditable]');
  if (!editable) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
