/* eslint-disable import/no-duplicates */
import { Parameter } from '@concordium/web-sdk/types';
import * as ElectionContract from '../../__generated__/election-contract/module_election';
import ElectionContractWorker from './worker?worker';
import { ElectionContractWorkerMessage, ElectionContractWorkerTag, WorkerResponse } from './worker';
import { ChecksumUrl } from '../types';

const worker = new ElectionContractWorker();

export * from '../../__generated__/election-contract/module_election';

let i = 0;
function invokeWorker<R>(message: Omit<ElectionContractWorkerMessage, 'id'>): Promise<R> {
    const id = i;
    i++;

    const promise = new Promise<R>((resolve) => {
        const handleMessage = (event: MessageEvent<WorkerResponse<R>>) => {
            if (event.data.id === id) {
                resolve(event.data.response);
                worker.removeEventListener('message', handleMessage);
            }
        };
        worker.addEventListener('message', handleMessage);
    });
    worker.postMessage({ id, ...message });
    return promise;
}

/**
 * Gets the configuration of the election contract. This parses the contract response in a background worker.
 * @param contract - The election contract instance to query
 * @returns A promise resolving with the corresponding {@linkcode ElectionContract.ReturnValueViewConfig}
 */
export async function getElectionConfig(
    contract: ElectionContract.Type,
): Promise<ElectionContract.ReturnValueViewConfig | undefined> {
    const res = await ElectionContract.dryRunViewConfig(contract, Parameter.empty());

    const config = await invokeWorker<ElectionContract.ReturnValueViewConfig | undefined>({
        tag: ElectionContractWorkerTag.ParseConfig,
        message: res,
    });
    if (config !== undefined) {
        // All number values are parsed as bigints. These are byte arrays, and are expected to be passed as numbers to
        // election guard.
        config.guardian_keys = config.guardian_keys.map((key) => key.map((byte) => Number(byte)));
    }

    return config;
}

/**
 * Gets the current state of all guardians. This parses the contract response in a background worker.
 * @param contract - The election contract instance to query
 * @returns A promise resolving with the corresponding {@linkcode ElectionContract.ReturnValueViewGuardiansState}
 */
export async function getGuardiansState(
    contract: ElectionContract.Type,
): Promise<ElectionContract.ReturnValueViewGuardiansState | undefined> {
    const res = await ElectionContract.dryRunViewGuardiansState(contract, Parameter.empty());
    return invokeWorker<ElectionContract.ReturnValueViewGuardiansState | undefined>({
        tag: ElectionContractWorkerTag.ParseGuardians,
        message: res,
    });
}

/**
 * A result for a single candidate
 */
export type CandidateResult = {
    /** The URL to the candidate data */
    candidate: ChecksumUrl;
    /** The cummulative votes for the candidate */
    cummulative_votes: number | bigint;
};

/**
 * Gets the election result (if available). This parses the contract response in a background worker.
 * @param contract - The election contract instance to query
 * @returns A promise resolving with the election result or undefined
 */
export async function getElectionResult(contract: ElectionContract.Type): Promise<CandidateResult[] | undefined> {
    const res = await ElectionContract.dryRunViewElectionResult(contract, Parameter.empty());
    const parsed = await invokeWorker<ElectionContract.ReturnValueViewElectionResult | undefined>({
        tag: ElectionContractWorkerTag.ParseElectionResult,
        message: res,
    });

    if (parsed?.type !== 'Some') {
        return undefined;
    }

    return parsed.content;
}
