import { AccountAddress, AccountKeys, Base58String, Energy, WalletExportFormat } from '@concordium/web-sdk';
import { invoke } from '@tauri-apps/api';
import { ElectionManifest, ElectionParameters } from 'shared/types';
import { Buffer } from 'buffer/';
import { appWindow } from '@tauri-apps/api/window';
import { UnlistenFn, Event } from '@tauri-apps/api/event';

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
export type GuardianData = {
    /** The account address */
    account: Base58String;
    /** The keys for the account */
    keys: AccountKeys;
    /** The guardian index associated with the account */
    index: number;
};

/**
 * Wraps `import_wallet_account` invocation.
 *
 * @param walletExport - The wallet export to import
 * @param guardianIndex - The guardian index associated with the account
 * @param password - The password to use for encrypting the data file associated with the account.
 *
 * @returns The {@linkcode GuardianData} when import is successful.
 * @throws If the account has already been imported or if the password is infallible
 */
export function importWalletAccount(
    walletExport: WalletExportFormat,
    guardianIndex: number,
    password: string,
): Promise<GuardianData> {
    return ensureErrors(
        invoke<GuardianData>('import_wallet_account', { walletAccount: walletExport, guardianIndex, password }),
    );
}

/**
 * Wraps `get_accounts` invocation. Gets the list of accounts which have already been imported into the application.
 *
 * @returns The list of {@linkcode AccountAddress.Type} found.
 */
export async function getAccounts(): Promise<AccountAddress.Type[]> {
    const accounts = await ensureErrors(invoke<Base58String[]>('get_accounts'));
    return accounts.map(AccountAddress.fromBase58);
}

/**
 * Wraps `load_account` invocation, which loads the {@linkcode GuardianData} from disk.
 *
 * @param account - The account to load
 * @param password - The password to use for decrypting the data file associated with the account.
 *
 * @returns The {@linkcode GuardianData}.
 */
export function loadAccount(account: AccountAddress.Type, password: string): Promise<GuardianData> {
    return ensureErrors(invoke<GuardianData>('load_account', { account: AccountAddress.toBase58(account), password }));
}

/**
 * Wraps `set_eg_config` invocation, storing the election guard config required for construction of election guard
 * entities.
 *
 * @param manifest - The election guard manifest
 * @param parameters - The election guard parameters
 */
export function setElectionGuardConfig(manifest: ElectionManifest, parameters: ElectionParameters) {
    return ensureErrors(invoke('set_eg_config', { manifest, parameters }));
}

/**
 * Wraps `generate_key_pair` invocation, which generates a key pair to be used by the active guardian account.
 *
 * @returns A {@linkcode Uint8Array} corresponding to an election guard `GuardianPublicKey` serialized with msgpack
 * @throws If the key pair could not be generated
 */
export async function generateKeyPair(): Promise<Uint8Array> {
    const byteArray = await ensureErrors(invoke<number[]>('generate_key_pair'));
    return Buffer.from(byteArray);
}

const REGISTER_KEY_CHANNEL_ID = 'register-key';

export async function* sendPublicKeyRegistration(): AsyncGenerator<Energy.Type, void, boolean> {
    console.log('INIT');
    // The protocol for this interaction is:
    // 1. Request transaction approval for estimate (first value yield) or throw
    // 2. Await transaction finalization (return value) or throw

    const invocation = ensureErrors(
        invoke<void>('send_public_key_registration', { channelId: REGISTER_KEY_CHANNEL_ID }),
    );

    let unsub: UnlistenFn | undefined;
    const keyRegistrationEstimate = new Promise<Energy.Type>((resolve) => {
        void appWindow
            .once(REGISTER_KEY_CHANNEL_ID, (event: Event<number>) => {
                resolve(Energy.create(event.payload));
            })
            .then((unsubfun) => {
                unsub = unsubfun;
            });
    });

    try {
        const estimate = await Promise.race([keyRegistrationEstimate, invocation]);
        console.log('FIRST ASYNC', estimate);
        if (estimate !== undefined) {
            // This will always be true in practice, as otherwise `invocation` would throw due to how the protocol is built.
            const approval = yield estimate;
            console.log('APPROVAL', approval);
            void appWindow.emit(REGISTER_KEY_CHANNEL_ID, approval); // Will be rejected by backend if false
        }
    } catch (e) {
        unsub?.();
    }

    const res = await invocation;
    console.log('LAST ASYNC', res);

    return res;
}
