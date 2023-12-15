/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import { useCallback, useMemo } from 'react';
import * as eg from 'electionguard-bindings';
import { useAtomValue } from 'jotai';
import { electionGuardConfigAtom } from './store';
import { getGuardianPublicKeys } from './election-contract';

export interface ElectionGuard {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getEncryptedBallot(selection: eg.SingleContestSelection): any;
}

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

            return eg.getEncryptedBallot(selection, context, DEVICE_NAME);
        },
        [config, guardianPublicKeys],
    );

    return useMemo<ElectionGuard>(() => ({ getEncryptedBallot }), [getEncryptedBallot]);
}
