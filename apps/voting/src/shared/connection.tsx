import {
    BrowserWalletConnector,
    CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    WalletConnectConnector,
    WalletConnection,
    WalletConnector,
} from '@concordium/wallet-connectors';
import { SignClientTypes } from '@walletconnect/types';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const WALLET_CONNECT_OPTS: SignClientTypes.Options = {
    projectId: CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    metadata: {
        name: 'Concordium governance committee voting',
        description: 'Application for voting for the Concordium governance committee',
        url: '#',
        icons: ['https://walletconnect.com/walletconnect-logo.png'],
    },
};

interface Wallet {
    account: string | undefined;
    chain: string | undefined;
    connection: WalletConnection;
}

export type ActiveWallet = Partial<Wallet>;

const activeWalletContext = createContext<ActiveWallet>({});

/**
 * Provides access to properties of the active wallet of type {@linkcode ActiveWallet}.
 */
export function useActiveWallet() {
    return useContext(activeWalletContext);
}

/**
 * Describes the properties provided by any wallet context, i.e. {@linkcode browserWalletContext} or
 * {@linkcode walletConnectContext}.
 */
export type ConnectorContext = WalletConnector & {
    isConnecting: boolean;
    isActive: boolean;
};

const initialConnectorContext: ConnectorContext = {
    isConnecting: false,
    isActive: false,
    connect() {
        throw new Error('Not inititialized');
    },
    disconnect() {
        throw new Error('Not inititialized');
    },
    getConnections() {
        throw new Error('Not inititialized');
    },
};

const browserWalletContext = createContext<ConnectorContext>(initialConnectorContext);
const walletConnectContext = createContext<ConnectorContext>(initialConnectorContext);

/**
 * Provides access to managing connection(s) to the Concordium browser wallet
 */
export function useBrowserWallet() {
    return useContext(browserWalletContext);
}

/**
 * Provides access to managing connection(s) wallet connect compatible Concordium wallets, e.g. Concordium mobile
 * wallets.
 */
export function useWalletConnect() {
    return useContext(walletConnectContext);
}

function useWalletConnector(wc: WalletConnector): ConnectorContext {
    const { connection, account } = useContext(activeWalletContext);
    const [isConnecting, setIsConnecting] = useState(false);
    const isActive = useMemo(
        () => connection !== undefined && wc.getConnections().includes(connection),
        [connection, wc],
    );

    const connect = useCallback(async () => {
        setIsConnecting(true);
        try {
            return await wc.connect();
        } finally {
            setIsConnecting(false);
        }
    }, [wc]);

    useEffect(() => {
        if (isActive && account === undefined) {
            void wc.disconnect();
        }
    }, [account, isActive, wc]);

    return {
        isConnecting,
        isActive,
        connect,
        disconnect: wc.disconnect,
        getConnections: wc.getConnections,
    };
}

type WalletProviderProps = PropsWithChildren<{
    connector: WalletConnector;
}>;

function WalletProvider({ connector, children }: WalletProviderProps) {
    const contextValue = useWalletConnector(connector);

    const Provider = useMemo(() => {
        if (connector instanceof BrowserWalletConnector) {
            return browserWalletContext.Provider;
        } else if (connector instanceof WalletConnectConnector) {
            return walletConnectContext.Provider;
        } else {
            throw new Error(`Unsupported connector`);
        }
    }, [connector]);

    return <Provider value={contextValue}>{children}</Provider>;
}

export type WalletsProviderProps = PropsWithChildren<{
    /** Connector instance to the Concordium browser wallet */
    browser: BrowserWalletConnector;
    /** Connector instance to wallet connect compatible Concordium wallet */
    walletConnect: WalletConnectConnector;
    /** The currently active wallet */
    activeWallet: ActiveWallet;
}>;

/**
 * Component whose sole purpose is to provide connection management functionality to the component tree below the
 * component acting as wallet connector delegate.
 */
export function WalletsProvider({ browser, walletConnect, activeWallet, children }: WalletsProviderProps) {
    return (
        <activeWalletContext.Provider value={activeWallet}>
            <WalletProvider connector={browser}>
                <WalletProvider connector={walletConnect}>{children}</WalletProvider>
            </WalletProvider>
        </activeWalletContext.Provider>
    );
}
