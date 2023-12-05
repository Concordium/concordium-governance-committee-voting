/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import { useCallback, useMemo } from 'react';
import * as eg from 'electionguard-bindings';

declare const electionManifest: eg.ElectionManifest; // TODO: should be defined globally on build by reading from file on disk
declare const electionParameters: eg.ElectionParameters; // TODO: how do we generate these?

export function getEncryptedBallot(selection: eg.SingleContestSelection, guardianPublicKeys: eg.GuardianPublicKey[]) {
    return eg.getEncryptedBallot(selection, {
        election_manifest: electionManifest,
        election_parameters: electionParameters,
        guardian_public_keys: guardianPublicKeys,
    });
}

export interface ElectionGuard {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getEncryptedBallot(selection: eg.SingleContestSelection): any;
}

export function useElectionGuard(): ElectionGuard {
    const electionManifest: eg.ElectionManifest = undefined; // TODO: get from global store (lazily from election server).
    const electionParameters: eg.ElectionParameters = undefined; // TODO: how do we generate these??
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const guardianPublicKeys: eg.GuardianPublicKey[] = []; // TODO: get these from global store (lazily from contract).

    const getEncryptedBallot: ElectionGuard['getEncryptedBallot'] = useCallback(
        (selection) => {
            const context: eg.EncryptedBallotContext = {
                election_manifest: electionManifest,
                election_parameters: electionParameters,
                guardian_public_keys: guardianPublicKeys,
            };

            return eg.getEncryptedBallot(selection, context);
        },
        [electionManifest, electionParameters, guardianPublicKeys],
    );

    return useMemo<ElectionGuard>(() => ({ getEncryptedBallot }), [getEncryptedBallot]);
}
