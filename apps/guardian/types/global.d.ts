/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

type TargetNetwork = 'testnet' | 'mainnet';

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
