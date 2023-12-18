/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import { useCallback, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import type * as eg from 'electionguard-bindings';
import { electionGuardConfigAtom } from '../store';
import { getGuardianPublicKeys } from '../election-contract';
// vite constructs a default export.
// eslint-disable-next-line import/default
import ElectionGuardWorker from './worker?worker';

const worker = new ElectionGuardWorker();

type GetEncryptedBallotWasm = typeof eg.getEncryptedBallot;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MakeAsync<T extends (...args: any) => any> = (...args: Parameters<T>) => Promise<ReturnType<T>>;

const getEncryptedBallotWorker: MakeAsync<GetEncryptedBallotWasm> = (...args) => {
    const promise = new Promise<Uint8Array>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<ReturnType<GetEncryptedBallotWasm>>) => {
            resolve(event.data);
            worker.onmessage = null;
        };
        worker.onmessageerror = (event) => {
            reject(event);
            worker.onmessageerror = null;
        };
    });
    worker.postMessage(args);

    return promise;
};

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
    const config = useAtomValue(electionGuardConfigAtom);
    const guardianPublicKeys = useMemo(() => getGuardianPublicKeys(), []); // TODO: get these from global store (lazily from contract).

    const getEncryptedBallot: ElectionGuard['getEncryptedBallot'] = useCallback(
        (selection) => {
            if (config === undefined) {
                throw new Error('Expected election guard config to be available');
            }

            const context: eg.EncryptedBallotContext = {
                election_manifest: config.manifest,
                election_parameters: config.parameters,
                guardian_public_keys: guardianPublicKeys,
            };
            return getEncryptedBallotWorker(selection, context, DEVICE_NAME);
        },
        [config, guardianPublicKeys],
    );

    return useMemo<ElectionGuard>(() => ({ getEncryptedBallot }), [getEncryptedBallot]);
}
