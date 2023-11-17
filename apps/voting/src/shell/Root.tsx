import { WalletConnectionManager } from '@shared/wallet-connection';
import App from './App';
import { ElectionContractProvider } from '@shared/election-contract';

/**
 * The application root. This is in charge of setting up global contexts to be available from {@linkcode App} and
 * below (in the component tree).
 */
function Root() {
    return (
        <WalletConnectionManager>
            <ElectionContractProvider>
                <App />
            </ElectionContractProvider>
        </WalletConnectionManager>
    );
}

export default Root;
