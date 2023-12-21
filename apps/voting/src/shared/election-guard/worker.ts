/**
 * The purpose of this file is to do heavy computation involving election guard to be done in the background (in a
 * web worker). As such, this file should be used in a `Worker` context.
 */
import * as eg from 'electionguard-bindings';

type GetEncryptedBallot = typeof eg.getEncryptedBallot;

onmessage = function({ data: args }: MessageEvent<Parameters<GetEncryptedBallot>>) {
    const ballot = eg.getEncryptedBallot(...args);
    postMessage(ballot);
};
