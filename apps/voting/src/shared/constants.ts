import { TESTNET, MAINNET } from '@concordium/wallet-connectors';
import { ContractAddress } from '@concordium/web-sdk';

const IS_MAINNET = CONFIG.network === 'mainnet';
const { hostname, port, protocol } = new URL(CONFIG.node);

/** The Concordium network used for the application. */
export const NETWORK = IS_MAINNET ? MAINNET : TESTNET;
/** The Concordium node url used for querying data. */
export const GRPC_ADDRESS = `${protocol}//${hostname}`;
/** The port of the GRPC interface of the node accessible at {@linkcode GRPC_ADDRESS} */
export const GRPC_PORT = Number(port);

/** The contract address of the election smart contract */
export const CONTRACT_ADDRESS = ContractAddress.fromSerializable(CONFIG.contractAddress);
