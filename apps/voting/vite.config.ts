import { PluginOption, UserConfig, defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import handlebars from 'vite-plugin-handlebars';
import { v4 as uuid } from 'uuid';
import 'dotenv/config';

const DEFAULT_NETWORK = 'testnet';
const DEFAULT_NODE = 'http://localhost:20001';
const DEFAULT_BACKEND_API = ''; // App is served from the same URL as the API.

/**
 * Validates environment variable present at `envField` as a URL.
 *
 * @param envField - The name of the environment variable to validate
 * @throws If environment variable is deemed an invalid URL.
 */
function validateURL(envField: string, allowUnset = true): void {
    const urlCandidate = process.env[envField];
    if (!allowUnset && !urlCandidate) {
        console.log(envField, urlCandidate);
        throw new Error(`Value required for environment variable ${envField}`);
    }

    try {
        if (urlCandidate && !new URL(urlCandidate).hostname) {
            throw new Error(`Could not parse URL from ${urlCandidate}`);
        }
    } catch (e) {
        const message = (e as Error)?.message ?? e;
        throw new Error(`Malformed URL for environment variable "${envField}": ${message}`);
    }
}

function getConfig(): Config {
    // Validate network
    if (![undefined, 'mainnet', 'testnet'].includes(process.env.CCD_ELECTION_NETWORK)) {
        throw new Error(
            `Unexpected value for environment variable "CCD_ELECTION_NETWORK": ${process.env.CCD_ELECTION_NETWORK} (should be either "testnet" or "mainnet")`,
        );
    }

    const [, index, subindex] =
        process.env.CCD_ELECTION_CONTRACT_ADDRESS?.match(/<(\d*),(\d*)>/) ??
        (() => {
            throw new Error(
                'Environment variable "CCD_ELECTION_CONTRACT_ADDRESS" must be specified in the format "<1234,0>"',
            );
        })();

    // Validate node URL
    validateURL('CCD_ELECTION_NODE');

    return {
        node: process.env.CCD_ELECTION_NODE ?? DEFAULT_NODE,
        contractAddress: { index, subindex },
        network: process.env.CCD_ELECTION_NETWORK ?? DEFAULT_NETWORK,
    };
}

const viteConfig: UserConfig = {
    plugins: [
        react({ plugins: [['@swc-jotai/react-refresh', {}]] }),
        tsconfigPaths(),
        wasm() as PluginOption,
        topLevelAwait(), // For legacy browser compatibility
    ],
    worker: {
        plugins: [topLevelAwait(), wasm() as PluginOption],
    },
    define: {
        DEVICE_NAME: JSON.stringify(uuid()),
        BACKEND_API: JSON.stringify(DEFAULT_BACKEND_API),
    },
    resolve: {
        alias: {
            '@concordium/rust-bindings': '@concordium/rust-bindings/bundler', // Resolve bundler-specific wasm entrypoints.
        },
    },
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
    if (command === 'serve') {
        const config = getConfig();
        viteConfig.plugins!.push(
            handlebars({
                context: { config: JSON.stringify(config) },
                compileOptions: { noEscape: true },
            }) as PluginOption,
        );

        // Validate backend API URL
        validateURL('CCD_ELECTION_BACKEND_API', false);
        viteConfig.define!.BACKEND_API = JSON.stringify(process.env.CCD_ELECTION_BACKEND_API);
    }

    return viteConfig;
});
