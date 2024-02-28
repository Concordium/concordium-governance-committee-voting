/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AccountAddress, Base58String, CcdAmount, WalletExportFormat } from '@concordium/web-sdk';
import { invoke } from '@tauri-apps/api';
import { appWindow } from '@tauri-apps/api/window';
import { UnlistenFn, Event } from '@tauri-apps/api/event';

/**
 * Corresponds to the enum members of the backend `Error` type.
 */
export const enum BackendErrorType {
    /** Failed to connect to the node */
    NodeConnection = 'NodeConnection',
    /** Error happened while querying the node */
    Network = 'Network',
    /** Failed to decrypt the resource */
    DecryptionFailed = 'DecryptionFailed',
    /** Error happened while trying to fetch remote resource */
    Http = 'Http',
    /** Attempted to import an account which already exists on disk */
    ExistingAccount = 'ExistingAccount',
    /** Query rejected by the node, e.g. missing funds on account */
    QueryFailed = 'QueryFailed',
    /** Interaction with backend aborted by the user */
    AbortInteraction = 'AbortInteraction',
    /** Internal error when something unexpected happens */
    Internal = 'Internal',
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
        console.error((e as Error).message);
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
 * @throws Error of type {@linkcode BackendError} with additional information on the `type` property:
 * - `BackendErrorType.ExistingAccount` If the account has already been imported
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
 * @throws Error of type {@linkcode BackendError} with additional information on the `type` property:
 * - `BackendErrorType.DecryptionError` If the account data could not be decrypted successfully. This will most likely be due to the user giving an
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
    /** The deadline for registering decryption shares */
    delegationDeadline: Date;
    /** The election description */
    electionDescription: string;
    /** Whether the encrypted tally has been registered in the contract */
    hasEncryptedTally: boolean;
};

/**
 * Initiate a connection to the election contract.
 *
 * @returns Response of type {@linkcode ConnectResponse} on successful connection
 * @throws Error of type {@linkcode BackendError} with additional information on the `type` property:
 * - `BackendErrorType.NodeConnection`
 * - `BackendErrorType.NetworkError`
 * - `BackendErrorType.Http`
 */
export async function connect(): Promise<ElectionConfig> {
    const response = await invokeWrapped<any>('connect');
    const mapped: ElectionConfig = {
        ...response,
        electionStart: new Date(response.electionStart),
        electionEnd: new Date(response.electionEnd),
        delegationDeadline: new Date(response.delegationDeadline),
    };
    return mapped;
}

export const enum GuardianStatus {
    VerificationSuccessful = 'VerificationSuccessful',
    SharesVerificationFailed = 'SharesVerificationFailed',
    KeyVerificationFailed = 'KeyVerificationFailed',
}

/**
 * The state returned from the backend for a single guardian.
 */
export type GuardianState = {
    /** Whether the guardian has registered an encrypted share */
    hasEncryptedShares: boolean;
    /** The index of the guardian */
    index: number;
    /** Whether the guardian has registered a public key */
    hasPublicKey: boolean;
    /**
     * The current status registered by the guardian, either a form of complaint or an OK signal. `null` means no status
     * has been registered yet.
     */
    status: GuardianStatus | null;
    /** Whether the guardian has registered their share of the decryption. */
    hasDecryptionShare: boolean;
    /** Whether the guardian has registered proof of correct decryption. */
    hasDecryptionProof: boolean;
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
 * @throws Error of type {@linkcode BackendError} with additional information on the `type` property:
 * - `BackendErrorType.NetworkError` if an error happened while querying the contract for the guardian information
 */
export async function refreshGuardians(): Promise<[AccountAddress.Type, GuardianState][]> {
    const guardiansState = await invokeWrapped<[Base58String, GuardianState][]>('refresh_guardians');
    const mapped = guardiansState.map<[AccountAddress.Type, GuardianState]>(([address, state]) => [
        AccountAddress.fromBase58(address),
        state,
    ]);
    return mapped;
}

/**
 * Refresh the the encrypted tally, returning whether the tally was found in the contract.
 *
 * @returns A boolean signalling whether the encrypted tally was found.
 * @throws Error of type {@linkcode BackendError} with additional information on the `type` property:
 * - `BackendErrorType.NetworkError` if an error happened while querying the contract for the guardian information
 * - `BackendErrorType.Internal` if the tally registered in the contract could not be deserialized
 */
export async function refreshEncryptedTally(): Promise<boolean> {
    return invokeWrapped<boolean>('refresh_encrypted_tally');
}

/**
 * Creates a generator function representing an interaction with the backend through the supplied command.
 *
 * @template P - The type of the serialized payload received from the backend
 * @template Y - The type yielded by the generator.
 *
 * @param cmd - The backend command
 * @param convert - A function for converting the payload JSON type emitted from the backend to the type yielded
 *
 * @returns A generator function for interacting with the backend
 *
 * @example
 * const someBackendFlow = makeInteractionFlow<number, CcdAmount.Type>(
 *   'some_backend_flow',
 *   (proposal) => CcdAmount.fromMicroCcd(payload), // or whichever conversion wanted corresponding to P => Y
 * );
 * const abortController = new AbortController();
 * const generator = someBackendFlow(abortController.signal);
 * try {
 *   // Generate the keypair, create transaction proposal
 *   const proposal = await generator.next();
 *   // Approve transaction proposal (by supplying `true`), submit transaction and await finalization
 *   await generator.next(true);
 * } catch (e: Error) {
 *   // Do something with the error.
 * }
 */
function makeInteractionFlow<P, Y>(cmd: string, convert: (payload: P) => Y) {
    return async function* (abortSignal: AbortSignal): AsyncGenerator<Y, void, boolean> {
        const invocation = invokeWrapped<void>(cmd, { channelId: cmd });

        let unsub: UnlistenFn | undefined;
        const proposal = new Promise<Y>((resolve) => {
            void appWindow
                .once(cmd, (event: Event<P>) => {
                    resolve(convert(event.payload));
                })
                .then((unsubfun) => {
                    unsub = unsubfun;
                });
        });

        try {
            abortSignal.onabort = () => {
                void appWindow.emit(`${cmd}::ABORT`);
            };
            // The only instance where `invocation` is the triggering promise is upon rejection, so expecting `Energy.Type` here
            // is OK.
            const result = (await Promise.race([proposal, invocation])) as Y;

            const approval = yield result;
            void appWindow.emit(cmd, approval); // Will be rejected by backend if false

            return await invocation;
        } finally {
            unsub?.();
        }
    };
}

/**
 * Creates a generator for interacting with the backend to register a public key in the election contract. The protocol
 * for the interaction is:
 *
 * 1. Generate the keypair, await approval of transaction proposal
 * 2. Send transaction, await finalization on chain
 *
 * @param abortSignal - An abort signal which will terminate the interaction
 *
 * @yields 1. A proposed amount of {@linkcode Energy.Type} to use for the transaction
 * @yields 2. `void`, which signals the transaction has been submitted and finalized
 * @throws At any step in the interaction, {@linkcode BackendError} can be thrown, with additional information on the `type` property:
 * - `BackendErrorType.NodeConnection`
 * - `BackendErrorType.NetworkError`
 * - `BackendErrorType.QueryFailed`
 */
export const registerGuardianKey = makeInteractionFlow<number, CcdAmount.Type>(
    'register_guardian_key_flow',
    (payload) => CcdAmount.fromMicroCcd(payload),
);

/**
 * the possible transaction proposals from the {@linkcode registerGuardianShares} flow.
 */
export const enum ValidatedProposalType {
    /** Peer keys valid -> propose to register encrypted shares */
    Success = 'Success',
    /** One or more invalid peer keys -> propose to file a complaint */
    Complaint = 'Complaint',
}

/**
 * A transaction proposal from the {@linkcode registerGuardianShares} flow.
 */
export type ValidatedProposal = {
    /** The proposal type */
    type: ValidatedProposalType;
    /** The transaction fee of the proposed transaction */
    ccdCost: CcdAmount.Type;
};

type ValidatedProposalJSON = {
    type: ValidatedProposalType;
    ccdCost: number;
};

/**
 * Creates a generator for interacting with the backend to register encrypted shares in the election contract. The protocol
 * for the interaction is:
 *
 * 1. Validate peer keys, generate the shares, await approval of transaction proposal, which is one of:
 *   - Registration of encrypted shares
 *   - Filing of complaint due to invalid peer keys
 * 2. Send transaction, await finalization on chain
 *
 * @param abortSignal - An abort signal which will terminate the interaction
 *
 * @yields 1. A {@linkcode ValidatedProposal} to either accept or reject
 * @yields 2. `void`, which signals the transaction has been submitted and finalized
 * @throws At any step in the interaction, {@linkcode BackendError} can be thrown, with additional information on the `type` property:
 * - `BackendErrorType.NodeConnection`
 * - `BackendErrorType.NetworkError`
 * - `BackendErrorType.QueryFailed`
 */
export const registerGuardianShares = makeInteractionFlow<ValidatedProposalJSON, ValidatedProposal>(
    'register_guardian_shares_flow',
    (payload) => ({ ...payload, ccdCost: CcdAmount.fromMicroCcd(payload.ccdCost) }),
);

/**
 * Creates a generator for interacting with the backend to validate peer shares and generate the secret share. The protocol
 * for the interaction is:
 *
 * 1. Validate shares, generate secret share, await approval of transaction proposal, which is one of:
 *   - Signaling OK
 *   - Filing of complaint due to invalid peer shares
 * 2. Send transaction, await finalization on chain
 *
 * @param abortSignal - An abort signal which will terminate the interaction
 *
 * @yields 1. A {@linkcode ValidatedProposal} to either accept or reject
 * @yields 2. `void`, which signals the transaction has been submitted and finalized
 * @throws At any step in the interaction, {@linkcode BackendError} can be thrown, with additional information on the `type` property:
 * - `BackendErrorType.NodeConnection`
 * - `BackendErrorType.NetworkError`
 * - `BackendErrorType.QueryFailed`
 */
export const generateSecretShare = makeInteractionFlow<ValidatedProposalJSON, ValidatedProposal>(
    'generate_secret_share_flow',
    (payload) => ({ ...payload, ccdCost: CcdAmount.fromMicroCcd(payload.ccdCost) }),
);

/**
 * Creates a generator for interacting with the backend to generate decryption shares for all ciphertexts in the
 * encrypted tally. The protocol for the interaction is:
 *
 * 1. Generate decryption shares
 * 2. Send transaction, await finalization on chain
 *
 * @param abortSignal - An abort signal which will terminate the interaction
 *
 * @yields 1. A {@linkcode CcdAmount.Type} to either accept or reject
 * @yields 2. `void`, which signals the transaction has been submitted and finalized
 * @throws At any step in the interaction, {@linkcode BackendError} can be thrown, with additional information on the `type` property:
 * - `BackendErrorType.NodeConnection`
 * - `BackendErrorType.NetworkError`
 * - `BackendErrorType.QueryFailed`
 */
export const registerDecryptionShares = makeInteractionFlow<number, CcdAmount.Type>(
    'register_decryption_shares_flow',
    (payload) => CcdAmount.fromMicroCcd(payload),
);

/**
 * Creates a generator for interacting with the backend to generate decryption proofs for each decryption share registered.
 * The protocol for the interaction is:
 *
 * 1. Generate decryption proofs
 * 2. Send transaction, await finalization on chain
 *
 * @param abortSignal - An abort signal which will terminate the interaction
 *
 * @yields 1. A {@linkcode CcdAmount.Type} to either accept or reject
 * @yields 2. `void`, which signals the transaction has been submitted and finalized
 * @throws At any step in the interaction, {@linkcode BackendError} can be thrown, with additional information on the `type` property:
 * - `BackendErrorType.NodeConnection`
 * - `BackendErrorType.NetworkError`
 * - `BackendErrorType.QueryFailed`
 * - `BackendErrorType.DecryptionShareError` If one or more invalid decryption shares were detected, requiring manual
 *   intervention by the election coordinator (i.e. restart the tally phase)
 */
export const registerDecryptionProofs = makeInteractionFlow<number, CcdAmount.Type>(
    'register_decryption_proofs_flow',
    (payload) => CcdAmount.fromMicroCcd(payload),
);
