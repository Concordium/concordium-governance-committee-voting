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

type Config = {
    node: string;
    contractAddress: { index: string; subindex: string };
    network: TargetNetwork;
};

declare const DEVICE_NAME: string;
declare const CONFIG: Config;
declare const BACKEND_API: string;
