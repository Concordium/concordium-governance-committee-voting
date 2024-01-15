import React from 'react';
import { createRoot } from 'react-dom/client';

import Root from '@shell/Root';
import './scss/index.scss';

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>,
);
