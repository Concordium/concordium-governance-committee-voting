import { Provider } from 'jotai/react';

import { initStore } from '~/shared/store';
import App from './App';

const store = initStore();

/**
 * The application root. This is in charge of setting up global contexts to be available from {@linkcode App} and
 * below (in the component tree).
 */
export default function Root() {
    return (
        <Provider store={store}>
            <App />
        </Provider>
    );
}
