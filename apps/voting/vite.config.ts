import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import 'dotenv/config';

if (![undefined, 'mainnet', 'testnet'].includes(process.env.CCD_ELECTION_NETWORK)) {
    throw new Error(
        `Unexpected value for environment variable "CCD_ELECTION_NETWORK": ${process.env.CCD_ELECTION_NETWORK} (should be either "testnet" or "mainnet")`,
    );
}

if (!process.env.CCD_ELECTION_CONTRACT_ADDRESS?.match(/<\d*,\d*>/)) {
    throw new Error('Environment variable "CCD_ELECTION_CONTRACT_ADDRESS" must be specified in the format "<1234,0>"');
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react({ plugins: [['@swc-jotai/react-refresh', {}]] }),
        tsconfigPaths(),
        wasm(),
        topLevelAwait(), // For legacy browser compatibility
    ],
    define: {
        'process.env': {
            CCD_ELECTION_NETWORK: process.env.CCD_ELECTION_NETWORK ?? 'testnet',
            CCD_ELECTION_NODE: process.env.CCD_ELECTION_NODE,
            CCD_ELECTION_CONTRACT_ADDRESS: process.env.CCD_ELECTION_CONTRACT_ADDRESS,
        },
    },
    resolve: {
        alias: {
            '@concordium/rust-bindings': '@concordium/rust-bindings/bundler', // Resolve bundler-specific wasm entrypoints.
        },
    },
});
