/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** The election contract address passed from environment variables at build time */
    readonly CCD_ELECTION_CONTRACT_ADDRESS: string;
    /** The Concordium node URL passed from environment variables at build time */
    readonly CCD_ELECTION_NODE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
