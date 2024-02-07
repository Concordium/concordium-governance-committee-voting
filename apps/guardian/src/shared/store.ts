import { atom, createStore } from 'jotai';
import { AccountAddress } from '@concordium/web-sdk/types';

import { BackendError, ElectionConfig, GuardiansState, connect, getAccounts, refreshGuardians } from './ffi';

/** The interval at which the guardians state will refresh from the contract */
const GUARDIANS_UPDATE_INTERVAL = 30000;
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
    Setup = 'Setup',
    Voting = 'Voting',
    Tally = 'Tally',
}

/**
 * Describes the different phases of the election setup phase
 */
export const enum SetupStep {
    GenerateKey,
    AwaitPeerKeys,
    GenerateDecryptionShare,
    AwaitPeerShares,
    ValidatePeerShares,
}

/**
 * The active election step, which is a combination of the active {@linkcode ElectionPhase} and the step within the
 * election phase.
 */
export type ElectionStep =
    | { phase: ElectionPhase.Setup; step: SetupStep }
    | { phase: ElectionPhase.Voting }
    | { phase: ElectionPhase.Tally };

const electionPhaseBaseAtom = atom<ElectionPhase | undefined>(undefined);

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
                if (guardians.every(([, g]) => g.hasEncryptedShares)) return SetupStep.ValidatePeerShares;
                if (guardian.hasEncryptedShares) return SetupStep.AwaitPeerShares;
                if (guardians.every(([, g]) => g.hasPublicKey)) return SetupStep.GenerateDecryptionShare;
                if (guardian.hasPublicKey) return SetupStep.AwaitPeerKeys;
                return SetupStep.GenerateKey;
            })();

            return { phase, step };
        }

        if (phase === ElectionPhase.Voting) {
            return { phase };
        }

        if (phase === ElectionPhase.Tally) {
            return { phase };
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

/**
 * Initializes the global store with data fetched from the backend
 */
export function initStore() {
    const store = createStore();

    void store.set(electionConfigAtom);
    void store.set(accountsAtom);

    void store.set(guardiansStateAtom);
    const id = setInterval(() => {
        const electionConfig = store.get(electionConfigBaseAtom);
        if (electionConfig === undefined) {
            return;
        }

        if (new Date() >= electionConfig.electionStart) {
            clearInterval(id);
            return;
        }

        void store.set(guardiansStateAtom);
    }, GUARDIANS_UPDATE_INTERVAL);

    store.set(electionStepAtom);
    setInterval(() => {
        store.set(electionStepAtom);
    }, REFRESH_ELECTION_PHASE_INTERVAL);

    return store;
}
