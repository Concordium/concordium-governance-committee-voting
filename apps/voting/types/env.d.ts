/// <reference types="vite/client" />

type TargetNetwork = 'testnet' | 'mainnet';

declare namespace NodeJS {
    export interface ProcessEnv {
        readonly CCD_ELECTION_NETWORK: TargetNetwork;
        readonly CCD_ELECTION_CONTRACT_ADDRESS: string;
        readonly CCD_ELECTION_NODE: string;
    }
}
