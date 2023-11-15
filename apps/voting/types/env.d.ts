/// <reference types="vite/client" />

type TargetNetwork = 'testnet' | 'mainnet';

declare namespace NodeJS {
    export interface ProcessEnv {
        readonly VITE_NETWORK: TargetNetwork;
    }
}
