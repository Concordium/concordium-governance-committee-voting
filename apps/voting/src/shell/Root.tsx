import { Provider } from 'jotai';
import { RouterProvider } from 'react-router-dom';
import { WalletConnectionManager } from '~/shared/wallet-connection';
import { initStore } from '~/shared/store';
import { router } from './router';

const store = initStore();

/**
 * The application root. This is in charge of setting up global contexts to be available from {@linkcode App} and
 * below (in the component tree).
 */
function Root() {
    return (
        <Provider store={store}>
            <WalletConnectionManager>
                <RouterProvider router={router} />
            </WalletConnectionManager>
        </Provider>
    );
}

export default Root;
