import { atom, createStore } from 'jotai';
import { AccountAddress } from '@concordium/web-sdk/types';

import {
    BackendError,
    BackendErrorType,
    ElectionConfig,
    GuardianState,
    GuardianStatus,
    GuardiansState,
    connect,
    getAccounts,
    refreshEncryptedTally,
    refreshGuardians,
} from './ffi';

/** The interval at which the guardians state will refresh from the contract */
const CONTRACT_UPDATE_INTERVAL = 30000;
/** The interval at which the the election phase is recalculated based on the contract configuration */
const REFRESH_ELECTION_PHASE_INTERVAL = 5000;

/**
 * Primitive atom for holding the {@linkcode ElectionConfig} of the election contract
 */
const electionConfigBaseAtom = atom<ElectionConfig | undefined>(undefined);
export const electionConfigAtom = atom(
    (get) => get(electionConfigBaseAtom),
    async (_, set) => {
        try {
            set(electionConfigBaseAtom, await connect());
            set(connectionErrorAtom, undefined);
        } catch (e: unknown) {
            set(connectionErrorAtom, e as BackendError);
        }
    },
);

/**
 * Represents the different phases of the election
 */
export const enum ElectionPhase {
    /**
     * The setup phase of the election where guardians generate and register the necessary keys to decrypt the election
     * result in the tally phase.
     */
    Setup = 'Setup',
    /**
     * The voting phase of the election where eligible voters cast their votes.
     */
    Voting = 'Voting',
    /**
     * The tally/finalization phase where the election result is decrypted and registered.
     */
    Tally = 'Tally',
}

/**
 * Describes the different phases of the election setup phase
 */
export const enum SetupStep {
    /** Generate the guardian key pair to be used */
    GenerateKey,
    /** Await peer submissions of public keys */
    AwaitPeerKeys,
    /** Validate peer public key submissions and generate encrypted shares of secret key for each peer */
    GenerateEncryptedShares,
    /** Await peer submissions of encrypted shares */
    AwaitPeerShares,
    /** Validate peer shares submissions and generate secret share of decryption key */
    GenerateSecretShare,
    /** Await peer validation of submissions by their peers */
    AwaitPeerValidation,
    /** Setup phase completed */
    Done,
    /**
     * Setup phase invalidated. This occurs when one or more guardians have registered a validation error at some point
     * during the setup phase
     */
    Invalid,
}

export const enum TallyStep {
    AwaitEncryptedTally,
    TallyError,
    GenerateDecryptionShare,
    AwaitPeerShares,
    GenerateDecryptionProof,
    DecryptionProofError,
    Done,
}

/**
 * The active election step, which is a combination of the active {@linkcode ElectionPhase} and the step within the
 * election phase.
 */
export type ElectionStep =
    | { phase: ElectionPhase.Setup; step: SetupStep }
    | { phase: ElectionPhase.Voting }
    | { phase: ElectionPhase.Tally; step: TallyStep };

const electionPhaseBaseAtom = atom<ElectionPhase | undefined>(undefined);

const setupCompleted = (guardian: GuardianState) =>
    guardian.hasPublicKey && guardian.hasEncryptedShares && guardian.status === GuardianStatus.VerificationSuccessful;

/**
 * Exposes the current {@linkcode ElectionStep}. Invoking the setter recomputes the active election step.
 */
export const electionStepAtom = atom<ElectionStep | undefined, [], void>(
    (get) => {
        const phase = get(electionPhaseBaseAtom);
        const selectedAccount = get(selectedAccountAtom);
        const guardians = get(guardiansStateBaseAtom);
        if (selectedAccount === undefined || guardians === undefined || phase === undefined) return undefined;

        const guardian = guardians.find(([account]) => AccountAddress.equals(account, selectedAccount))?.[1];
        if (guardian === undefined) return undefined;

        if (phase === ElectionPhase.Setup) {
            const step = (() => {
                if (guardians.some(([, g]) => g.status !== null && g.status !== GuardianStatus.VerificationSuccessful))
                    return SetupStep.Invalid;
                if (guardians.every(([, g]) => setupCompleted(g))) return SetupStep.Done;
                if (setupCompleted(guardian)) return SetupStep.AwaitPeerValidation;
                if (guardians.every(([, g]) => g.hasPublicKey && g.hasEncryptedShares))
                    return SetupStep.GenerateSecretShare;
                if (guardian.hasPublicKey && guardian.hasEncryptedShares) return SetupStep.AwaitPeerShares;
                if (guardians.every(([, g]) => g.hasPublicKey)) return SetupStep.GenerateEncryptedShares;
                if (guardian.hasPublicKey) return SetupStep.AwaitPeerKeys;
                return SetupStep.GenerateKey;
            })();

            return { phase, step };
        }

        if (phase === ElectionPhase.Voting) {
            return { phase };
        }

        if (phase === ElectionPhase.Tally) {
            const hasTally = get(hasTallyAtom);

            const step = (() => {
                if (hasTally instanceof BackendError) return TallyStep.TallyError;
                if (hasTally) return TallyStep.GenerateDecryptionShare;
                return TallyStep.AwaitEncryptedTally;
            })();

            return { phase, step };
        }

        return undefined;
    },
    (get, set) => {
        const electionConfig = get(electionConfigAtom);
        const now = new Date();

        if (electionConfig === undefined) return;

        let phase: ElectionPhase;
        if (now < electionConfig.electionStart) {
            phase = ElectionPhase.Setup;
        } else if (now > electionConfig.electionEnd) {
            phase = ElectionPhase.Tally;
        } else {
            phase = ElectionPhase.Voting;
        }

        set(electionPhaseBaseAtom, phase);
    },
);

/**
 * Holds significant errors (those which are relevant to the user) happening while communicating with the backend.
 */
export const connectionErrorAtom = atom<BackendError | undefined>(undefined);

/** The base atom holding the {@linkcode GuardiansState} */
const guardiansStateBaseAtom = atom<GuardiansState | undefined>(undefined);
/** Whether the guardians state is currently refreshing */
const guardiansLoadingAtom = atom(false);

/**
 * Atom for accessing collective guardians state.
 * Invoking the setter for this atom refreshes the guardians state, regardless of the arguments passed.
 */
export const guardiansStateAtom = atom(
    (get) => ({
        loading: get(guardiansLoadingAtom),
        guardians: get(guardiansStateBaseAtom),
    }),
    async (_, set) => {
        set(guardiansLoadingAtom, true);
        try {
            set(guardiansStateBaseAtom, await refreshGuardians());
            set(connectionErrorAtom, undefined);
        } catch (e: unknown) {
            set(connectionErrorAtom, e as BackendError);
        } finally {
            set(guardiansLoadingAtom, false);
        }
    },
);

/**
 * Holds the account the application is currently using.
 */
export const selectedAccountAtom = atom<AccountAddress.Type | undefined>(undefined);

/**
 * Base atom holding the list of accounts imported into the application
 */
const accountsBaseAtom = atom<AccountAddress.Type[] | undefined>(undefined);
/**
 * Readonly atom for accessing the imported accounts.
 * Invoking the setter refreshes the accounts.
 */
export const accountsAtom = atom(
    (get) => get(accountsBaseAtom),
    async (_, set) => {
        set(accountsBaseAtom, await getAccounts());
    },
);

const hasTallyBaseAtom = atom<boolean | BackendError | undefined>(undefined);

/**
 * Readonly atom for accessing whether an encrypted tally is available.
 * Invoking the setter refreshes the state from the contract.
 */
export const hasTallyAtom = atom(
    (get) => get(hasTallyBaseAtom),
    async (_, set) => {
        let value;
        try {
            value = await refreshEncryptedTally();
        } catch (e: unknown) {
            value = e as BackendError;
        }

        if (value instanceof BackendError && value.type !== BackendErrorType.Internal) {
            set(connectionErrorAtom, value);
            return;
        }

        set(hasTallyBaseAtom, value);
    },
);

/**
 * Initializes the global store with data fetched from the backend
 */
export function initStore() {
    const store = createStore();

    void store.set(electionConfigAtom);
    void store.set(accountsAtom);

    void store.set(guardiansStateAtom);
    void store.set(hasTallyAtom);
    setInterval(() => {
        void store.set(guardiansStateAtom);
        const electionPhase = store.get(electionPhaseBaseAtom);

        if (electionPhase === ElectionPhase.Tally && store.get(hasTallyAtom) !== true) {
            void store.set(hasTallyAtom);
        }
    }, CONTRACT_UPDATE_INTERVAL);

    store.set(electionStepAtom);
    setInterval(() => {
        store.set(electionStepAtom);
    }, REFRESH_ELECTION_PHASE_INTERVAL);

    return store;
}
