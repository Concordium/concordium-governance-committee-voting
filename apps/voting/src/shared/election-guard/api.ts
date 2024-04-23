import { useCallback, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import type * as eg from 'electionguard-bindings';
import { electionConfigAtom, guardiansStateAtom } from '../store';
// vite constructs a default export.
// eslint-disable-next-line import/default
import ElectionGuardWorker from './worker?worker';

const worker = new ElectionGuardWorker();

type GetEncryptedBallotWasm = typeof eg.getEncryptedBallot;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MakeAsync<T extends (...args: any) => any> = (...args: Parameters<T>) => Promise<ReturnType<T>>;

/**
 * Constructs a promise which resolves upon receiving a message from {@linkcode worker} and sends a message which
 * constructs an encrypted ballot from the arguments given.
 */
const getEncryptedBallotWorker: MakeAsync<GetEncryptedBallotWasm> = (...args) => {
    const promise = new Promise<Uint8Array>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<ReturnType<GetEncryptedBallotWasm>>) => {
            resolve(event.data);
            worker.onmessage = null;
        };
        worker.onerror = (event) => {
            reject(event.message);
            worker.onerror = null;
        };
    });
    worker.postMessage(args);

    return promise;
};

/**
 * Describes the election guard API
 */
export interface ElectionGuard {
    /**
     * Constructs an encrypted ballot from a selection of candidates. The list is expected to be ordered by candidate
     * index.
     *
     * @param selection - The list of candidate selections to construct an encrypted ballot from.
     *
     * @returns A promise which resolves with an encrypted ballot in the form of a byte array.
     * @throws If the ballot could not be created.
     */
    getEncryptedBallot(selection: eg.SingleContestSelection): Promise<Uint8Array>;
}

/**
 * A hook which exposes an interface for interacting with election guard.
 */
export function useElectionGuard(): ElectionGuard {
    const config = useAtomValue(electionConfigAtom);
    const guardians = useAtomValue(guardiansStateAtom);

    const getEncryptedBallot: ElectionGuard['getEncryptedBallot'] = useCallback(
        (selection) => {
            if (guardians?.guardianKeys === undefined || config === undefined) {
                throw new Error('Expected election guard config and guardian keys to be available');
            }

            const context: eg.EncryptedBallotContext = {
                election_manifest: config.manifest,
                election_parameters: config.parameters,
                guardian_public_keys: guardians.guardianKeys,
            };
            return getEncryptedBallotWorker(selection, context, DEVICE_NAME);
        },
        [config, guardians],
    );

    return useMemo<ElectionGuard>(() => ({ getEncryptedBallot }), [getEncryptedBallot]);
}
