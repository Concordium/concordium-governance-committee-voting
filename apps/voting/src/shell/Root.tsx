import { WithWalletConnector } from '@concordium/react-components';
import { NETWORK } from '../shared/constants';
import App from './App';
import { connectionContext } from '../shared/connection';

function Root() {
    return (
        <WithWalletConnector network={NETWORK}>
            {(props) => (
                <connectionContext.Provider value={props}>
                    <App />
                </connectionContext.Provider>
            )}
        </WithWalletConnector>
    );
}

export default Root;
