import { NETWORK } from '../shared/constants';
import App from './App';
import { Component, PropsWithChildren } from 'react';
import {
    BrowserWalletConnector,
    WalletConnectConnector,
    WalletConnection,
    WalletConnectionDelegate,
} from '@concordium/wallet-connectors';
import { ActiveWallet, WALLET_CONNECT_OPTS, WalletsProvider } from '../shared/connection';

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

type WalletConnectionManagerProps = PropsWithChildren;
interface WalletConnectionManagerState {
    browserWalletConnector: BrowserWalletConnector | undefined;
    walletConnectConnector: WalletConnectConnector | undefined;
    connections: WalletConnection[];
    accounts: Map<WalletConnection, string | undefined>;
    chains: Map<WalletConnection, string | undefined>;
}

class WalletConnectionManager
    extends Component<WalletConnectionManagerProps, WalletConnectionManagerState>
    implements WalletConnectionDelegate {
    constructor(props: WalletConnectionManagerProps) {
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
            const connections = state.connections.filter((c) => c !== connection);
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
        const { browserWalletConnector, walletConnectConnector } = this.state;
        if (browserWalletConnector === undefined || walletConnectConnector === undefined) {
            return null;
        }

        const connection = this.state.connections[0];
        const activeWallet: ActiveWallet =
            connection === undefined
                ? {}
                : {
                    chain: this.state.chains.get(connection),
                    account: this.state.accounts.get(connection),
                    connection,
                };

        return (
            <WalletsProvider
                browser={browserWalletConnector}
                walletConnect={walletConnectConnector}
                activeWallet={activeWallet}
            >
                {this.props.children}
            </WalletsProvider>
        );
    }
}

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
