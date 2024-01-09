import { RouterProvider } from 'react-router-dom';
import { createStore } from 'jotai';
import { Provider, useAtomValue } from 'jotai/react';

import { electionConfigAtom } from '~/shared/store';
import { router } from './router';

const store = createStore();

/**
 * Component which ensures selected parts of global state stays in memory for the lifetime of the application
 */
function EnsureGlobalState() {
    useAtomValue(electionConfigAtom);
    return null;
}

/**
 * The application root. This is in charge of setting up global contexts to be available from {@linkcode router} and
 * below (in the component tree).
 */
export default function Root() {
    return (
        <Provider store={store}>
            <EnsureGlobalState />
            <RouterProvider router={router} />
        </Provider>
    );
}
