import { ConcordiumGRPCWebClient } from '@concordium/web-sdk/grpc';
import * as ElectionContract from 'shared/election-contract';
import { CONTRACT_ADDRESS, GRPC_ADDRESS, GRPC_PORT } from './constants';

const grpc = new ConcordiumGRPCWebClient(GRPC_ADDRESS, GRPC_PORT);
const contract = ElectionContract.createUnchecked(grpc, CONTRACT_ADDRESS);

/**
 * Gets the configuration of the election contract.
 * @returns A promise resolving with the corresponding {@linkcode ElectionContract.ReturnValueViewConfig}
 */
export async function getElectionConfig(): Promise<ElectionContract.ReturnValueViewConfig | undefined> {
    return ElectionContract.getElectionConfig(contract);
}
