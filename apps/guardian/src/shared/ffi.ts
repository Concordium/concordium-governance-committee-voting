/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AccountAddress, Base58String, Energy, WalletExportFormat } from '@concordium/web-sdk';
import { invoke } from '@tauri-apps/api';
import { appWindow } from '@tauri-apps/api/window';
import { UnlistenFn, Event } from '@tauri-apps/api/event';

/**
 * Corresponds to the enum members of the backend `Error` type.
 */
export const enum BackendErrorType {
    NodeConnection = 'NodeConnection',
    NetworkError = 'NetworkError',
    DecryptionError = 'DecryptionError',
    Http = 'Http',
    ExistingAccount = 'ExistingAccount',
    QueryFailed = 'QueryFailed',
    AbortInteraction = 'AbortInteraction',
}

type BackendErrorJSON = { type: BackendErrorType; message: string };

/**
 * Represents any error originating in the backend
 */
export class BackendError extends Error {
    private constructor(
        public type: BackendErrorType,
        message: string,
    ) {
        super(message);
    }

    /**
     * Converts errors serialized by the backend into proper `BackendError`
     */
    public static fromJSON({ type, message }: BackendErrorJSON): BackendError {
        return new BackendError(type, message);
    }
}

/**
 * Wraps {@linkcode invoke} to properly deserialize errors originating from the backend
 */
const invokeWrapped: typeof invoke = async (...args) => {
    try {
        return await invoke(...args);
    } catch (e) {
        throw BackendError.fromJSON(e as BackendErrorJSON);
    }
};

/**
 * Wraps `import_wallet_account` invocation.
 *
 * @param walletExport - The wallet export to import
 * @param guardianIndex - The guardian index associated with the account
 * @param password - The password to use for encrypting the data file associated with the account.
 *
 * @returns The {@linkcode AccountAddress.Type} when import is successful.
 * @throws If the account has already been imported
 */
export async function importWalletAccount(
    walletExport: WalletExportFormat,
    guardianIndex: number,
    password: string,
): Promise<AccountAddress.Type> {
    const account = await invokeWrapped<Base58String>('import_wallet_account', {
        walletAccount: walletExport,
        guardianIndex,
        password,
    });
    return AccountAddress.fromBase58(account);
}

/**
 * Wraps `get_accounts` invocation. Gets the list of accounts which have already been imported into the application.
 *
 * @returns The list of {@linkcode AccountAddress.Type} found.
 */
export async function getAccounts(): Promise<AccountAddress.Type[]> {
    const accounts = await invokeWrapped<Base58String[]>('get_accounts');
    return accounts.map(AccountAddress.fromBase58);
}

/**
 * Wraps `load_account` invocation, which loads the {@linkcode GuardianData} from disk.
 *
 * @param account - The account to load
 * @param password - The password to use for decrypting the data file associated with the account.
 *
 * @returns `void` if account is successfully loaded
 * @throws {@linkcode BackendError} If the account data could not be decrypted successfully. This will most likely be due to the user giving an
 * incorrect password, but could also mean the data stored has been corrupted
 */
export function loadAccount(account: AccountAddress.Type, password: string): Promise<void> {
    return invokeWrapped<void>('load_account', { account: AccountAddress.toBase58(account), password });
}

/**
 * The election config from {@linkcode connect}, corresponding to the configuration registered in the election contract
 * upon contract initialization.
 */
export type ElectionConfig = {
    /** The election start time */
    electionStart: Date;
    /** The election end time */
    electionEnd: Date;
    /** The election description */
    electionDescription: string;
};

/**
 * Initiate a connection to the election contract.
 *
 * @returns {@linkcode ConnectResponse} on successful connection
 * @throws {@linkcode BackendError}:
 * - Connecting to the node
 * - Querying the node
 * - Fetching remote resources
 */
export async function connect(): Promise<ElectionConfig> {
    const response = await invokeWrapped<any>('connect');
    const mapped: ElectionConfig = {
        ...response,
        electionStart: new Date(response.electionStart),
        electionEnd: new Date(response.electionEnd),
    };
    return mapped;
}

/**
 * The state returned from the backend for a single guardian.
 */
export type GuardianState = {
    /** Whether the guardian has registered an encrypted share */
    hasEncryptedShare: boolean;
    /** The index of the guardian */
    index: number;
    /** Whether the guardian has registered a public key */
    hasPublicKey: boolean;
    /**
     * The current status registered by the guardian, either a form of complaint or an OK signal. `null` means no status
     * has been registered yet.
     */
    status: number | null;
};

/**
 * The collective state of all guardians and their corresponding account address.
 */
export type GuardiansState = [AccountAddress.Type, GuardianState][];

/**
 * Refresh the data stored for all guardians. Getting fresh data can be used to determine if the election is in a state
 * where new actions need to be performed by the active guardian.
 *
 * @returns The collective state of all guardians.
 * @throws {@linkcode BackendError} if an error happened while querying the contract for the guardian information.
 */
export async function refreshGuardians(): Promise<[AccountAddress.Type, GuardianState][]> {
    const guardiansState = await invokeWrapped<[Base58String, GuardianState][]>('refresh_guardians');
    const mapped = guardiansState.map<[AccountAddress.Type, GuardianState]>(([address, state]) => [
        AccountAddress.fromBase58(address),
        state,
    ]);
    return mapped;
}

const REGISTER_KEY_CHANNEL_ID = 'register-key';

/**
 * Creates a generator for interacting with the backend to register a public key in the election contract. The protocol
 * for the interaction is:
 *
 * 1. Generate the keypair, await approval of transaction proposal
 * 2. send transaction, await finalization on chain
 *
 * @returns 1. A proposed amount of {@linkcode Energy.Type} to use for the transaction
 * @returns 2. `void`, which signals the transaction has been submitted and finalized
 * @throws {@linkcode BackendError} At any step in the interaction, errors can be thrown
 *
 * @example
 * const registerKey = sendPublicKeyRegistration();
 * try {
 *   // Generate the keypair, create transaction proposal
 *   const proposal_energy = await registerKey.next();
 *   // Approve transaction proposal (by supplying `true`), submit transaction and await finalization
 *   await registerKey.next(true);
 * } catch (e: Error) {
 *   // Do something with the error.
 * }
 */
export async function* registerGuardianKey(): AsyncGenerator<Energy.Type, void, boolean> {
    const invocation = invokeWrapped<void>('register_guardian_key', { channelId: REGISTER_KEY_CHANNEL_ID });

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
        // The only instance where `invocation` is the triggering promise is upon rejection, so expecting `Energy.Type` here
        // is OK.
        const result = (await Promise.race([keyRegistrationEstimate, invocation])) as Energy.Type;

        const approval = yield result;
        void appWindow.emit(REGISTER_KEY_CHANNEL_ID, approval); // Will be rejected by backend if false

        return await invocation;
    } finally {
        unsub?.();
    }
}
