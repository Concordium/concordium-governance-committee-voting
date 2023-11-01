import {
    BrowserWalletConnector,
    CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    WalletConnectConnector,
    WalletConnection,
} from '@concordium/wallet-connectors';
import { SignClientTypes } from '@walletconnect/types';
import { createContext } from 'react';

export const WALLET_CONNECT_OPTS: SignClientTypes.Options = {
    projectId: CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    metadata: {
        name: 'Concordium governance committee voting',
        description: 'Application for voting for the Concordium governance committee',
        url: '#',
        icons: ['https://walletconnect.com/walletconnect-logo.png'],
    },
};

interface WalletState {
    account: string | undefined;
    chain: string | undefined;
    connection: WalletConnection;
}

export type ConnectionContext = Partial<WalletState>;

export const connectionContext = createContext<ConnectionContext>({});

// Cast as any, as it will be provided in Root component, which only renders subtree if connectors are defined.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
export const browserWalletContext = createContext<BrowserWalletConnector>(undefined as any);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
export const walletConnectContext = createContext<WalletConnectConnector>(undefined as any);
