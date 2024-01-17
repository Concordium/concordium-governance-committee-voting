import { AccountKeys, Base58String, WalletExportFormat } from '@concordium/web-sdk';
import { invoke } from '@tauri-apps/api';

export type WalletAccount = {
    address: Base58String;
    keys: AccountKeys;
};

/**
 * Wraps `import_wallet_account` invocation.
 *
 * @param walletExport - The wallet export to import
 * @param password - The password to use for encrypting the data file associated with the account.
 *
 * @returns The {@linkcode WalletAccount} when import is successful.
 */
export async function importWalletAccount(walletExport: WalletExportFormat, password: string): Promise<WalletAccount> {
    return invoke('import_wallet_account', { walletAccount: walletExport, password });
}
