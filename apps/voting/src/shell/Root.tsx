import { WalletConnectionManager } from '@shared/wallet-connection';
import App from './App';
import { Provider, createStore, useAtomValue } from 'jotai';
import { electionConfigAtom } from '@shared/store';

const store = createStore();

function EnsureGlobalState() {
    useAtomValue(electionConfigAtom);
    return null;
}

/**
 * The application root. This is in charge of setting up global contexts to be available from {@linkcode App} and
 * below (in the component tree).
 */
function Root() {
    return (
        <WalletConnectionManager>
            <Provider store={store}>
                <EnsureGlobalState />
                <App />
            </Provider>
        </WalletConnectionManager>
    );
}

export default Root;
