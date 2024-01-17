import { AccountAddress, AccountKeys, Base58String, WalletExportFormat } from '@concordium/web-sdk';
import { invoke } from '@tauri-apps/api';

/**
 * Helper function which wraps strings thrown due to errors in proper `Error` types. This is needed as the errors
 * returned from the rust backend are deserialized as strings in the frontend.
 */
async function ensureErrors<T>(promise: Promise<T>): Promise<T> {
    try {
        return await promise;
    } catch (e) {
        if (typeof e === 'string') {
            throw new Error(e);
        }

        throw e;
    }
}

/**
 * The wallet account as returned from the rust backend process.
 */
export type WalletAccount = {
    /** The account address */
    address: Base58String;
    /** The keys for the account */
    keys: AccountKeys;
};

/**
 * Wraps `import_wallet_account` invocation.
 *
 * @param walletExport - The wallet export to import
 * @param password - The password to use for encrypting the data file associated with the account.
 *
 * @returns The {@linkcode WalletAccount} when import is successful.
 * @throws If the account has already been imported or if the password is infallible
 */
export function importWalletAccount(walletExport: WalletExportFormat, password: string): Promise<WalletAccount> {
    return ensureErrors(invoke<WalletAccount>('import_wallet_account', { walletAccount: walletExport, password }));
}

export async function getAccounts(): Promise<AccountAddress.Type[]> {
    const accounts = await ensureErrors(invoke<Base58String[]>('get_accounts'));
    return accounts.map(AccountAddress.fromBase58);
}

export function loadAccount(account: AccountAddress.Type, password: string): Promise<WalletAccount> {
    return ensureErrors(invoke<WalletAccount>('load_account', { account: AccountAddress.toBase58(account), password }));
}
