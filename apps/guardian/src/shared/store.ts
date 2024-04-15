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
import { expectValue } from 'shared/util';

/** The interval at which the guardians state will refresh from the contract */
const CONTRACT_UPDATE_INTERVAL = 30000;
/** The interval at which the the election phase is recalculated based on the contract configuration */
const REFRESH_ELECTION_PHASE_INTERVAL = 1000;

const electionConfigErrorAtom = atom<BackendError | undefined>(undefined);

/**
 * Primitive atom for holding the {@linkcode ElectionConfig} of the election contract
 */
const electionConfigBaseAtom = atom<ElectionConfig | undefined>(undefined);
/**
 * Holds the {@linkcode ElectionConfig}. Invoking the setter reloads the configuration from the backend.
 */
export const electionConfigAtom = atom(
    (get) => get(electionConfigBaseAtom),
    async (_, set) => {
        try {
            set(electionConfigBaseAtom, await connect());
            set(electionConfigErrorAtom, undefined);
        } catch (e: unknown) {
            set(electionConfigErrorAtom, e as BackendError);
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
    /** The setup phase was not completed prior to the election beginning */
    Incomplete,
}

export const enum TallyStep {
    AwaitEncryptedTally,
    TallyError,
    Excluded,
    GenerateDecryptionShare,
    AwaitPeerShares,
    Incomplete,
    GenerateDecryptionProof,
    AwaitPeerProofs,
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

export const setupCompleted = (guardian: GuardianState) =>
    guardian.hasPublicKey && guardian.hasEncryptedShares && guardian.status === GuardianStatus.VerificationSuccessful;

/**
 * Exposes the current {@linkcode ElectionStep}. Invoking the setter recomputes the active election step.
 */
export const electionStepAtom = atom<ElectionStep | undefined, [], void>(
    (get) => {
        const phase = get(electionPhaseBaseAtom);
        const guardians = get(guardiansStateBaseAtom)?.map(([, g]) => g);
        const guardian = get(selectedGuardianAtom);
        if (guardian === undefined || guardians === undefined || phase === undefined) return undefined;

        if (guardians.some((g) => g.status !== null && g.status !== GuardianStatus.VerificationSuccessful)) {
            return { phase: ElectionPhase.Setup, step: SetupStep.Invalid };
        }

        if (phase !== ElectionPhase.Setup && guardians.some((g) => !setupCompleted(g))) {
            return { phase: ElectionPhase.Setup, step: SetupStep.Incomplete };
        }

        if (phase === ElectionPhase.Setup) {
            const step = (() => {
                if (guardians.every(setupCompleted)) return SetupStep.Done;
                if (setupCompleted(guardian)) return SetupStep.AwaitPeerValidation;
                if (guardians.every((g) => g.hasPublicKey && g.hasEncryptedShares))
                    return SetupStep.GenerateSecretShare;
                if (guardian.hasPublicKey && guardian.hasEncryptedShares) return SetupStep.AwaitPeerShares;
                if (guardians.every((g) => g.hasPublicKey)) return SetupStep.GenerateEncryptedShares;
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
            const electionConfig = expectValue(
                get(electionConfigAtom),
                'Election config should be available at this point',
            );
            const now = new Date();

            const includedGuardians = guardians.filter((g) => !g.excluded);
            const step = (() => {
                if (includedGuardians.every((g) => g.hasDecryptionShare && g.hasDecryptionProof)) return TallyStep.Done;
                if (guardian.hasDecryptionShare && guardian.hasDecryptionProof) return TallyStep.AwaitPeerShares;
                if (
                    electionConfig.decryptionDeadline < now &&
                    includedGuardians.filter((g) => g.hasDecryptionShare).length < electionConfig.guardianThreshold
                )
                    return TallyStep.Incomplete;
                if (includedGuardians.every((g) => g.hasDecryptionShare) || electionConfig.decryptionDeadline < now)
                    return TallyStep.GenerateDecryptionProof;
                if (guardian.hasDecryptionShare) return TallyStep.AwaitPeerShares;
                if (guardian.excluded) return TallyStep.Excluded;
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

const guardiansStateErrorAtom = atom<BackendError | undefined>(undefined);
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
            set(guardiansStateErrorAtom, undefined);
        } catch (e: unknown) {
            set(guardiansStateErrorAtom, e as BackendError);
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
 * Exposes the {@linkcode GuardianState} of the currently selected guardian account
 */
export const selectedGuardianAtom = atom<GuardianState | undefined>((get) => {
    const account = get(selectedAccountAtom);
    const guardians = get(guardiansStateBaseAtom);

    if (account === undefined || guardians === undefined) return undefined;
    return guardians.find(([gAccount]) => AccountAddress.equals(gAccount, account))?.[1];
});

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

const hasTallyConnectionErrorAtom = atom<BackendError | undefined>(undefined);
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
            set(hasTallyConnectionErrorAtom, undefined);
        } catch (e: unknown) {
            value = e as BackendError;
        }

        if (value instanceof BackendError && value.type !== BackendErrorType.Internal) {
            set(hasTallyConnectionErrorAtom, value);
        }

        set(hasTallyBaseAtom, value);
    },
);

/**
 * Holds significant errors (those which are relevant to the user) happening while communicating with the backend.
 */
export const connectionErrorAtom = atom(
    (get) => get(electionConfigErrorAtom) ?? get(guardiansStateErrorAtom) ?? get(hasTallyConnectionErrorAtom),
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
