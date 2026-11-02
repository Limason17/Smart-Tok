import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/literata/wght.css';
import '@fontsource-variable/literata/wght-italic.css';
import './ui/styles.css';
import { App } from './ui/App';
import { init } from './store/store';
import { startAccounts } from './sync/account';

void init().then(startAccounts);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
