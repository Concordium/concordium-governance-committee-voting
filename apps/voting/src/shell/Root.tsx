import { WalletConnectionManager } from '@shared/wallet-connection';
import App from './App';

/**
 * The application root. This is in charge of setting up global contexts to be available from {@linkcode App} and
 * below (in the component tree).
 */
function Root() {
    return (
        <WalletConnectionManager>
            <App />
        </WalletConnectionManager>
    );
}

export default Root;
