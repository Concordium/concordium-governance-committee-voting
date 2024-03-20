/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

type TargetNetwork = 'testnet' | 'mainnet';

declare namespace NodeJS {
    export interface ProcessEnv {
        /** The {@linkcode TargetNetwork} passed from environment variables at build time */
        readonly CCD_ELECTION_NETWORK: TargetNetwork;
        /** The election contract address passed from environment variables at build time */
        readonly CCD_ELECTION_CONTRACT_ADDRESS: string;
        /** The Concordium node URL passed from environment variables at build time */
        readonly CCD_ELECTION_NODE: string;
        /** The URL of the backend API */
        readonly CCD_ELECTION_BACKEND_API: string;
    }
}

/**
 * The configuration built into the application when served from the backend API
 */
type Config = {
    /** The URL of the node. Must have grpc-web enabled. */
    node: string;
    /** The contract address of the election contract instance used. */
    contractAddress: { index: string; subindex: string };
    /** The concordium network used. */
    network: TargetNetwork;
};

/** The device name used for election guard */
declare const DEVICE_NAME: string;
/** The configuration built into the application when served from the backend API */
declare const CONFIG: Config;
/** The URL for the backend API */
declare const BACKEND_API: string;
