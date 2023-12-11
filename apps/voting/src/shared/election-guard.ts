/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import { useCallback, useMemo } from 'react';
import * as eg from 'electionguard-bindings';

export interface ElectionGuard {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getEncryptedBallot(selection: eg.SingleContestSelection): any;
}

export function useElectionGuard(): ElectionGuard {
    const electionManifest: eg.ElectionManifest = undefined; // TODO: Should be built into the application
    const electionParameters: eg.ElectionParameters = undefined; // TODO: Should be built into the application
    const guardianPublicKeys: eg.GuardianPublicKey[] = []; // TODO: get these from global store (lazily from contract).

    const getEncryptedBallot: ElectionGuard['getEncryptedBallot'] = useCallback(
        (selection) => {
            const context: eg.EncryptedBallotContext = {
                election_manifest: electionManifest,
                election_parameters: electionParameters,
                guardian_public_keys: guardianPublicKeys,
            };

            return eg.getEncryptedBallot(selection, context, DEVICE_NAME);
        },
        [electionManifest, electionParameters, guardianPublicKeys],
    );

    return useMemo<ElectionGuard>(() => ({ getEncryptedBallot }), [getEncryptedBallot]);
}
