import * as ElectionContract from 'shared/election-contract';
import * as schema from 'shared/election-contract/schema';
import {
    AccountTransactionType,
    ConcordiumGRPCWebClient,
    toBuffer,
    UpdateContractPayload,
    CcdAmount,
    ReceiveName,
    EntrypointName,
    Energy,
    AccountAddress,
    TransactionHash,
    Parameter,
} from '@concordium/web-sdk';
import { TypedSmartContractParameters, WalletConnection } from '@concordium/wallet-connectors';

import { CONTRACT_ADDRESS, GRPC_ADDRESS, GRPC_PORT } from './constants';

const grpc = new ConcordiumGRPCWebClient(GRPC_ADDRESS, GRPC_PORT);
const contract = ElectionContract.createUnchecked(grpc, CONTRACT_ADDRESS);

const registerVotesSchema = toBuffer(schema.entrypoints.registerVotes.parameter, 'base64');

/**
 * Register a ballot in the election contract.
 *
 * @param ballot - The ballot to register the votes for
 * @param connection - The wallet connection to use for sending the transaction
 * @param accountAddress - The account address to send from
 *
 * @throws If the contract could not be updated
 * @returns A promise resolving with the corresponding {@linkcode TransactionHash.Type}
 */
export async function registerVotes(
    ballot: ElectionContract.RegisterVotesParameter,
    connection: WalletConnection,
    accountAddress: AccountAddress.Type,
): Promise<TransactionHash.Type> {
    const params: TypedSmartContractParameters = {
        parameters: ballot,
        schema: { type: 'TypeSchema', value: registerVotesSchema },
    };

    const result = await ElectionContract.dryRunRegisterVotes(contract, ballot);
    if (result.tag === 'failure' || result.returnValue === undefined) {
        throw new Error('Failed to invoke contract');
    }

    const maxContractExecutionEnergy = Energy.create(result.usedEnergy.value + 1n); // +1 needs to be here, as there seems to be an issue with running out of energy 1 energy prior to reaching the execution limit
    const payload: Omit<UpdateContractPayload, 'message'> = {
        amount: CcdAmount.zero(),
        address: CONTRACT_ADDRESS,
        receiveName: ReceiveName.create(ElectionContract.contractName, EntrypointName.fromString('registerVotes')),
        maxContractExecutionEnergy,
    };
    return connection
        .signAndSendTransaction(AccountAddress.toBase58(accountAddress), AccountTransactionType.Update, payload, params)
        .then(TransactionHash.fromHexString);
}

/**
 * Gets the configuration of the election contract.
 * @returns A promise resolving with the corresponding {@linkcode ElectionContract.ReturnValueViewConfig}
 */
export function getElectionConfig(): Promise<ElectionContract.ReturnValueViewConfig | undefined> {
    return ElectionContract.getElectionConfig(contract);
}

/**
 * Gets the current state of all guardians
 * @returns A promise resolving with the corresponding @linkcode ElectionContract.ReturnValueViewGuardiansState}
 */
export async function getGuardiansState(): Promise<ElectionContract.ReturnValueViewGuardiansState | undefined> {
    const res = await ElectionContract.dryRunViewGuardiansState(contract, Parameter.empty());
    return ElectionContract.parseReturnValueViewGuardiansState(res);
}
