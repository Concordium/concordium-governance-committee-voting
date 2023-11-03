import { useCallback } from 'react';
import { useActiveWallet, useBrowserWallet } from '../shared/connection';
import { Button } from 'react-bootstrap';

function App() {
    const { account, connection } = useActiveWallet();
    const { isActive, isConnecting, connect } = useBrowserWallet();

    const openWalletOptions = useCallback(() => {
        if (isActive || isConnecting) {
            return;
        }

        void connect();
    }, [connect, isActive, isConnecting]);

    return (
        <>
            {connection ? (
                account
            ) : (
                <Button variant="primary" onClick={openWalletOptions}>
                    Connect
                </Button>
            )}
        </>
    );
}

export default App;
