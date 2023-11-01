import { NETWORK } from '../shared/constants';
import App from './App';
import { Component } from 'react';
import {
    BrowserWalletConnector,
    WalletConnectConnector,
    WalletConnection,
    WalletConnectionDelegate,
} from '@concordium/wallet-connectors';
import {
    ConnectionContext,
    WALLET_CONNECT_OPTS,
    browserWalletContext,
    connectionContext,
    walletConnectContext,
} from '../shared/connection';

function updateMapEntry<K, V>(map: Map<K, V>, key: K | undefined, value: V | undefined) {
    const res = new Map(map);
    if (key !== undefined) {
        if (value !== undefined) {
            res.set(key, value);
        } else {
            res.delete(key);
        }
    }
    return res;
}

type Props = Record<string, never>;
interface State {
    browserWalletConnector: BrowserWalletConnector | undefined;
    walletConnectConnector: WalletConnectConnector | undefined;
    connections: WalletConnection[];
    accounts: Map<WalletConnection, string | undefined>;
    chains: Map<WalletConnection, string | undefined>;
}

class Root extends Component<Props, State> implements WalletConnectionDelegate {
    constructor(props: Props) {
        super(props);

        this.state = {
            browserWalletConnector: undefined,
            walletConnectConnector: undefined,
            connections: [],
            accounts: new Map(),
            chains: new Map(),
        };
    }
    onChainChanged(connection: WalletConnection, genesisHash: string): void {
        this.setState((state) => ({
            ...state,
            chains: updateMapEntry(state.chains, connection, genesisHash),
        }));
    }
    onAccountChanged(connection: WalletConnection, address: string | undefined): void {
        this.setState((state) => ({
            ...state,
            accounts: updateMapEntry(state.accounts, connection, address),
        }));
    }
    onConnected(connection: WalletConnection, address: string | undefined): void {
        this.setState((state) => {
            // The first entry is the active connection.
            const connections = [connection, ...state.connections.filter((c) => c === connection)];
            return {
                ...state,
                connections,
                accounts: updateMapEntry(state.accounts, connection, address),
            };
        });
    }
    onDisconnected(connection: WalletConnection): void {
        this.setState((state) => {
            const connections = state.connections.filter((c) => c === connection);
            return {
                ...state,
                connections,
                accounts: updateMapEntry(state.accounts, connection, undefined),
                chains: updateMapEntry(state.chains, connection, undefined),
            };
        });
    }

    async componentDidMount(): Promise<void> {
        const bwPromise = BrowserWalletConnector.create(this);
        const wcPromise = WalletConnectConnector.create(WALLET_CONNECT_OPTS, this, NETWORK);
        const [bw, wc] = await Promise.all([bwPromise, wcPromise]);

        this.setState({ browserWalletConnector: bw, walletConnectConnector: wc });
    }

    render() {
        const connection = this.state.connections[0];
        const contextValue: ConnectionContext =
            connection === undefined
                ? {}
                : {
                    chain: this.state.chains.get(connection),
                    account: this.state.accounts.get(connection),
                    connection,
                };

        if (this.state.browserWalletConnector === undefined || this.state.walletConnectConnector === undefined) {
            return null;
        }

        return (
            <connectionContext.Provider value={contextValue}>
                <browserWalletContext.Provider value={this.state.browserWalletConnector}>
                    <walletConnectContext.Provider value={this.state.walletConnectConnector}>
                        <App />
                    </walletConnectContext.Provider>
                </browserWalletContext.Provider>
            </connectionContext.Provider>
        );
    }
}

export default Root;
