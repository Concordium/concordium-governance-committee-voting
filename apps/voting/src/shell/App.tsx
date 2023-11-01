import { useContext, useEffect } from 'react';
import { browserWalletContext, connectionContext } from '../shared/connection';

function App() {
    const bw = useContext(browserWalletContext);
    const { connection, account } = useContext(connectionContext);

    console.log('account', account, connection);

    useEffect(() => {
        if (!bw.isConnected) {
            void bw.connect();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bw.isConnected]);

    return <>Voting app</>;
}

export default App;
