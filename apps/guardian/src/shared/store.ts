import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { AccountAddress, Timestamp } from '@concordium/web-sdk/types';
import { ElectionManifest, ElectionParameters } from 'shared/types';
import { getChecksumResource } from 'shared/util';

import { GuardiansState, getElectionConfig, getGuardiansState } from './election-contract';
import { WalletAccount, getAccounts } from './ffi';

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
    /** The election manifest, used by election guard */
    manifest: ElectionManifest;
    /** The election parameters, used by election guard */
    parameters: ElectionParameters;
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

        const mappedConfig: ElectionConfig = {
            start: Timestamp.toDate(config.election_start),
            end: Timestamp.toDate(config.election_end),
            description: config.election_description,
            manifest,
            parameters,
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

const GUARDIANS_UPDATE_INTERVAL = 30000;
const guardiansStateBaseAtom = atom<GuardiansState | undefined>(undefined);
const guardiansLoadingAtom = atom(false);

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

export const guardiansStateAtom = atom((get) => {
    get(updateGuardiansStateAtom);
    return get(guardiansStateBaseAtom);
});

/**
 * Holds the account the application is currently using.
 */
export const selectedAccountAtom = atom<WalletAccount | undefined>(undefined);

const accountsBaseAtom = atom<AccountAddress.Type[] | undefined>(undefined);

const loadAccountsAtom = atomEffect((get, set) => {
    if (get(accountsBaseAtom) === undefined) {
        void getAccounts().then((accounts) => set(accountsBaseAtom, accounts));
    }
});

export const accountsAtom = atom((get) => {
    get(loadAccountsAtom);
    return get(accountsBaseAtom);
});
