import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { AccountAddress, Timestamp } from '@concordium/web-sdk/types';
import { ElectionManifest, ElectionParameters } from 'shared/types';
import { getChecksumResource } from 'shared/util';

import { GuardiansState, getElectionConfig, getGuardiansState } from './election-contract';
import { setElectionGuardConfig, WalletAccount, getAccounts } from './ffi';

/**
 * Representation of the election configration.
 */
export interface ElectionConfig {
    /** The election start time */
    start: Date;
    /** The election end time */
    end: Date;
    /** The election description */
    description: string;
}

/**
 * Primitive atom for holding the {@linkcode ElectionConfig} of the election contract
 */
const electionConfigBaseAtom = atom<ElectionConfig | undefined>(undefined);

/**
 * Ensures an election config is fetched if the primitive atom holds no value.
 */
const ensureElectionConfigAtom = atomEffect((get, set) => {
    if (get(electionConfigBaseAtom) !== undefined) {
        return;
    }

    void getElectionConfig().then(async (config) => {
        if (config === undefined) {
            return undefined;
        }

        const electionManifestPromise = getChecksumResource<ElectionManifest>(config.election_manifest);
        const electionParametersPromise = getChecksumResource<ElectionParameters>(config.election_parameters);

        const [manifest, parameters] = await Promise.all([electionManifestPromise, electionParametersPromise]);

        void setElectionGuardConfig(manifest, parameters);

        const mappedConfig: ElectionConfig = {
            start: Timestamp.toDate(config.election_start),
            end: Timestamp.toDate(config.election_end),
            description: config.election_description,
        };

        set(electionConfigBaseAtom, mappedConfig);
    });
});

/**
 * Holds the configuration of the election contract. A reference to this should always be kept in the application root
 * to avoid having to fetch the configuration more than once.
 */
export const electionConfigAtom = atom((get) => {
    get(ensureElectionConfigAtom);
    return get(electionConfigBaseAtom);
});

/** The interval at which the guardians state will refresh from the contract */
const GUARDIANS_UPDATE_INTERVAL = 30000;
/** The base atom holding the {@linkcode GuardiansState} */
const guardiansStateBaseAtom = atom<GuardiansState | undefined>(undefined);
/** Whether the guardians state is currently refreshing */
const guardiansLoadingAtom = atom(false);

/**
 * Refreshes the guardians state from the election contract at the interval specified by {@linkcode GUARDIANS_UPDATE_INTERVAL}
 */
const updateGuardiansStateAtom = atomEffect((get, set) => {
    const value = get(guardiansStateBaseAtom);

    const updateValue = () => {
        set(guardiansLoadingAtom, true);
        void getGuardiansState()
            .then((guardiansState) => set(guardiansStateBaseAtom, guardiansState))
            .finally(() => set(guardiansLoadingAtom, false));
    };

    if (value === undefined) {
        updateValue();
    }

    const interval = setInterval(updateValue, GUARDIANS_UPDATE_INTERVAL);
    return () => {
        clearInterval(interval);
    };
});

/**
 * Exposes the guardians state.
 */
export const guardiansStateAtom = atom((get) => {
    get(updateGuardiansStateAtom);
    return get(guardiansStateBaseAtom);
});

/**
 * Holds the account the application is currently using.
 */
export const selectedAccountAtom = atom<WalletAccount | undefined>(undefined);

/**
 * Base atom holding the list of accounts imported into the application
 */
const accountsBaseAtom = atom<AccountAddress.Type[] | undefined>(undefined);

/**
 * Loads the accounts imported into the application.
 */
const loadAccountsAtom = atomEffect((get, set) => {
    if (get(accountsBaseAtom) === undefined) {
        void getAccounts().then((accounts) => set(accountsBaseAtom, accounts));
    }
});

/**
 * Exposes the accounts imported into the application.
 */
export const accountsAtom = atom((get) => {
    get(loadAccountsAtom);
    return get(accountsBaseAtom);
});
