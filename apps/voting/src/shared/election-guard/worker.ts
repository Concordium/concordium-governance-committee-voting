import * as eg from 'electionguard-bindings';

type GetEncryptedBallot = typeof eg.getEncryptedBallot;

onmessage = function ({ data: args }: MessageEvent<Parameters<GetEncryptedBallot>>) {
    const ballot = eg.getEncryptedBallot(...args);
    postMessage(ballot);
};
