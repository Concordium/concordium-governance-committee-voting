import { useEffect } from 'react';
import { useActiveConnection, useBrowserWallet } from '../shared/connection';

function App() {
    const { connect, isConnected } = useBrowserWallet();
    const { account, connection } = useActiveConnection();

    console.log('account', account, connection);

    useEffect(() => {
        if (!isConnected) {
            connect();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    return <>Voting app</>;
}

export default App;
