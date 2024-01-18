import { ConcordiumGRPCWebClient } from '@concordium/web-sdk/grpc';
import * as ElectionContract from 'shared/election-contract';
import { CONTRACT_ADDRESS, GRPC_ADDRESS, GRPC_PORT } from './constants';
import { Parameter } from '@concordium/web-sdk';

const grpc = new ConcordiumGRPCWebClient(GRPC_ADDRESS, GRPC_PORT);
const contract = ElectionContract.createUnchecked(grpc, CONTRACT_ADDRESS);

export type GuardiansState = ElectionContract.ReturnValueViewGuardiansState;

/**
 * Gets the configuration of the election contract.
 * @returns A promise resolving with the corresponding {@linkcode ElectionContract.ReturnValueViewConfig}
 */
export function getElectionConfig(): Promise<ElectionContract.ReturnValueViewConfig | undefined> {
    return ElectionContract.getElectionConfig(contract);
}

export async function getGuardiansState(): Promise<GuardiansState | undefined> {
    const result = await ElectionContract.dryRunViewGuardiansState(contract, Parameter.empty());
    return ElectionContract.parseReturnValueViewGuardiansState(result);
}
