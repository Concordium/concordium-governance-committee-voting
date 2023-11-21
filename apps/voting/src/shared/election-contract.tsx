import * as ElectionContract from '../__generated__/election-contract/module_concordium_governance_committee_election';
import {
    AccountTransactionType,
    ConcordiumGRPCWebClient,
    Parameter,
    toBuffer,
    UpdateContractPayload,
    CcdAmount, ReceiveName,
    HexString,
    EntrypointName,
    Energy,
} from '@concordium/web-sdk';
import { CONTRACT_ADDRESS, GRPC_ADDRESS, GRPC_PORT } from './constants';
import { TypedSmartContractParameters, WalletConnection } from '@concordium/wallet-connectors';

export * as ElectionContract from '../__generated__/election-contract/module_concordium_governance_committee_election';

const grpc = new ConcordiumGRPCWebClient(GRPC_ADDRESS, GRPC_PORT);
const contract = ElectionContract.createUnchecked(grpc, CONTRACT_ADDRESS);

const REGISTER_VOTES_SCHEMA = toBuffer('EAIUAAIAAAAPAAAAY2FuZGlkYXRlX2luZGV4AggAAABoYXNfdm90ZQE=', 'base64');

export async function registerVotes(
    ballot: ElectionContract.RegisterVotesParameter,
    connection: WalletConnection,
    accountAddress: HexString,
): Promise<HexString> {
    const params: TypedSmartContractParameters = {
        parameters: ballot,
        schema: { type: 'TypeSchema', value: REGISTER_VOTES_SCHEMA },
    };

    const result = await ElectionContract.dryRunRegisterVotes(contract, ballot);
    if (result.tag === 'failure' || result.returnValue === undefined) {
        throw new Error('Failed to invoke contract');
    }

    const maxContractExecutionEnergy = Energy.create(result.usedEnergy.value * 2n);
    const payload: Omit<UpdateContractPayload, 'message'> = {
        amount: CcdAmount.zero(),
        address: CONTRACT_ADDRESS,
        receiveName: ReceiveName.create(ElectionContract.contractName, EntrypointName.fromString('registerVotes')),
        maxContractExecutionEnergy,
    };
    return await connection.signAndSendTransaction(
        accountAddress,
        AccountTransactionType.Update,
        payload,
        params,
    );
}

export async function getElectionConfig() {
    const result = await ElectionContract.dryRunViewConfig(contract, Parameter.empty());
    return ElectionContract.parseReturnValueViewConfig(result);
}
