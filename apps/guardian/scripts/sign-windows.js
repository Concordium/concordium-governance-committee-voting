import { execSync } from 'child_process';
import * as process from 'process';

// Check if signing is enabled
if (process.env.WINDOWS_SIGN !== '1') {
    console.log('Skipping signing.');
    process.exit(0);
}

// Ensure that WINDOWS_SM_KEYPAIR_ALIAS and WINDOWS_PKCS11_CONFIG are set in the environment
if (!process.env.WINDOWS_SM_KEYPAIR_ALIAS || !process.env.WINDOWS_PKCS11_CONFIG) {
    console.error('Error: WINDOWS_SM_KEYPAIR_ALIAS and WINDOWS_PKCS11_CONFIG environment variables must be set.');
    process.exit(1);
}

// Get the input path from command line arguments
const inputPath = process.argv[2];
if (!inputPath) {
    console.error('Error: No input path provided.');
    process.exit(1);
}

// Assign environment variables to script variables
const keypairAlias = process.env.WINDOWS_SM_KEYPAIR_ALIAS;
const config = process.env.WINDOWS_PKCS11_CONFIG;

try {
    // Execute the signing command
    const cmd = `smctl sign --keypair-alias "${keypairAlias}" --input "${inputPath}" --config-file "${config}" --verbose --exit-non-zero-on-fail --failfast`;
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
} catch (error) {
    console.error('Signing failed:', error.message);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    process.exit(error.status || 1);
}
