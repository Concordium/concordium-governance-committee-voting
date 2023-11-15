import { TESTNET, MAINNET } from '@concordium/wallet-connectors';

/**
 * The Concordium network used for the application.
 */
export const NETWORK = process.env.NETWORK === 'mainnet' ? MAINNET : TESTNET;
