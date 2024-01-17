import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { AccountAddress, Timestamp } from '@concordium/web-sdk/types';
import { ElectionManifest, ElectionParameters, GuardianPublicKey } from 'shared/types';
import { getChecksumResource } from 'shared/util';

import { getElectionConfig } from './election-contract';
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
    /** The registered public keys of the election guardians */
    guardianKeys: GuardianPublicKey[];
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
            guardianKeys: config.guardian_keys,
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
