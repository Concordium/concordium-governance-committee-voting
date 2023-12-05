/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
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
