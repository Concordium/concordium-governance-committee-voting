import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

if (![undefined, 'mainnet', 'testnet'].includes(process.env.NETWORK)) {
    throw new Error(
        `Unexpected value for environment variable "NETWORK": ${process.env.NETWORK} (should be either "testnet" or "mainnet")`,
    );
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    define: {
        'process.env': {
            NETWORK: process.env.NETWORK ?? 'testnet',
        },
    },
});
