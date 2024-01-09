import { Parameter } from '@concordium/web-sdk/types';
import * as ElectionContract from '../__generated__/election-contract/module_election';

export * from '../__generated__/election-contract/module_election';

/**
 * Gets the configuration of the election contract.
 * @param contract - The election contract instance to query
 * @returns A promise resolving with the corresponding {@linkcode ElectionContract.ReturnValueViewConfig}
 */
export async function getElectionConfig(
    contract: ElectionContract.Type,
): Promise<ElectionContract.ReturnValueViewConfig | undefined> {
    const result = await ElectionContract.dryRunViewConfig(contract, Parameter.empty());
    return ElectionContract.parseReturnValueViewConfig(result);
}
