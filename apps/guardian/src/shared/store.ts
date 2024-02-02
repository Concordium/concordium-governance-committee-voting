import { atom, createStore } from 'jotai';
import { AccountAddress } from '@concordium/web-sdk/types';

import { ElectionConfig, GuardiansState, connect, getAccounts, refreshGuardians } from './ffi';

/** The interval at which the guardians state will refresh from the contract */
const GUARDIANS_UPDATE_INTERVAL = 30000;

/**
 * Primitive atom for holding the {@linkcode ElectionConfig} of the election contract
 */
const electionConfigBaseAtom = atom<ElectionConfig | undefined>(undefined);
export const electionConfigAtom = atom((get) => get(electionConfigBaseAtom));

/** The base atom holding the {@linkcode GuardiansState} */
const guardiansStateBaseAtom = atom<GuardiansState | undefined>(undefined);
/** Whether the guardians state is currently refreshing */
const guardiansLoadingAtom = atom(false);

/** Readonly accounts for accessing the collective guardians state */
export const guardiansStateAtom = atom((get) => ({
    loading: get(guardiansLoadingAtom),
    guardians: get(guardiansStateBaseAtom),
}));

/**
 * Holds the account the application is currently using.
 */
export const selectedAccountAtom = atom<AccountAddress.Type | undefined>(undefined);

/**
 * Base atom holding the list of accounts imported into the application
 */
const accountsBaseAtom = atom<AccountAddress.Type[] | undefined>(undefined);
/** Readonly atom for accessing the imported accounts */
export const accountsAtom = atom((get) => get(accountsBaseAtom));

/**
 * Initializes the global store with data fetched from the backend
 */
export function initStore() {
    const store = createStore();

    void connect().then((electionConfig) => {
        store.set(electionConfigBaseAtom, electionConfig);
    });

    void getAccounts().then((accounts) => store.set(accountsBaseAtom, accounts));

    async function updateGuardiansStore() {
        store.set(guardiansLoadingAtom, true);

        try {
            store.set(guardiansStateBaseAtom, await refreshGuardians());
        } finally {
            store.set(guardiansLoadingAtom, false);
        }
    }

    void updateGuardiansStore();
    setInterval(() => {
        void updateGuardiansStore();
    }, GUARDIANS_UPDATE_INTERVAL);

    return store;
}
