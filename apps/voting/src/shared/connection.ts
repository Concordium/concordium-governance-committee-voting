import {
    WalletConnectionProps,
    useConnect,
    useConnection,
    BrowserWalletConnector,
    CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    WalletConnectConnector,
    ephemeralConnectorType,
    useWalletConnectorSelector,
    Connect,
    Connection,
    WalletConnectorSelector,
} from '@concordium/react-components';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { SignClientTypes } from '@walletconnect/types';

const WALLET_CONNECT_OPTS: SignClientTypes.Options = {
    projectId: CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    metadata: {
        name: 'Concordium governance committee voting',
        description: 'Application for voting for the Concordium governance committee',
        url: '#',
        icons: ['https://walletconnect.com/walletconnect-logo.png'],
    },
};

const BROWSER_WALLET = ephemeralConnectorType(BrowserWalletConnector.create);
const WALLET_CONNECT = ephemeralConnectorType(WalletConnectConnector.create.bind(this, WALLET_CONNECT_OPTS));

/**
 * The react context supplying the {@linkcode WalletConnectionProps}.
 * Provided from `Root` component, accessible from `App` component and the component tree below.
 */
export const connectionContext = createContext<WalletConnectionProps>({} as WalletConnectionProps);

/**
 * Used to select wallet connect as wallet provider.
 */
function useWalletConnectSelector() {
    const connectionProps = useContext(connectionContext);
    const { connection } = useConnection(connectionProps.connectedAccounts, connectionProps.genesisHashes);
    return useWalletConnectorSelector(WALLET_CONNECT, connection, connectionProps);
}

/**
 * Used to select the browser wallet as wallet provider.
 */
function useBrowserWalletSelector() {
    const connectionProps = useContext(connectionContext);
    const { connection } = useConnection(connectionProps.connectedAccounts, connectionProps.genesisHashes);
    return useWalletConnectorSelector(BROWSER_WALLET, connection, connectionProps);
}

export type UseWallet = Connect & Pick<WalletConnectorSelector, 'isConnected'>;
type Selector = () => WalletConnectorSelector;

const getUseWallet = (selector: Selector) => (): UseWallet => {
    const { select, isSelected, isConnected } = selector();
    const { connectedAccounts, genesisHashes, activeConnector } = useContext(connectionContext);
    const { setConnection, connection } = useConnection(connectedAccounts, genesisHashes);
    const { connect: _connect, isConnecting, connectError } = useConnect(activeConnector, setConnection);
    const isActive = useMemo(
        () => isSelected && activeConnector instanceof BrowserWalletConnector,
        [isSelected, activeConnector],
    );

    useEffect(() => {
        if (isActive) {
            _connect();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);

    function connect() {
        if (!isSelected) {
            select();
        } else if (activeConnector instanceof BrowserWalletConnector) {
            _connect();
        }
    }

    console.log('conn2', connection);

    return {
        connect,
        isConnecting,
        connectError,
        isConnected,
    };
};

/**
 * Hook exposing functionality for managing connection to browser wallet.
 */
export const useWalletConnect = getUseWallet(useWalletConnectSelector);

/**
 * Hook exposing functionality for managing connection to wallet connect.
 */
export const useBrowserWallet = getUseWallet(useBrowserWalletSelector);

/**
 * Holds details of a wallet connection. Returned by {@linkcode useActiveConnection}.
 */
export type ActiveConnection = Pick<Connection, 'genesisHash' | 'account' | 'connection'>;

/**
 * Hook for accessing the active connection (if any).
 */
export function useActiveConnection() {
    const { connectedAccounts, genesisHashes } = useContext(connectionContext);
    console.log(connectedAccounts);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { account, connection, genesisHash } = useConnection(connectedAccounts, genesisHashes);
    return { account, connection, genesisHash };
}
