import { createStore } from 'jotai';
import { Provider, useAtomValue } from 'jotai/react';

import { accountsAtom, electionConfigAtom, guardiansStateAtom } from '~/shared/store';
import App from './App';

const store = createStore();

/**
 * Component which ensures selected parts of global state stays in memory for the lifetime of the application
 */
function EnsureGlobalState() {
    useAtomValue(electionConfigAtom);
    useAtomValue(accountsAtom);
    useAtomValue(guardiansStateAtom);

    return null;
}

/**
 * The application root. This is in charge of setting up global contexts to be available from {@linkcode App} and
 * below (in the component tree).
 */
export default function Root() {
    return (
        <Provider store={store}>
            <EnsureGlobalState />
            <App />
        </Provider>
    );
}
