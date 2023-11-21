import { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import * as ElectionContract from '../__generated__/election-contract/module_concordium_governance_committee_election';
import {
    AccountTransactionType,
    ConcordiumGRPCWebClient,
    Parameter,
    toBuffer,
    UpdateContractPayload,
    CcdAmount,
    ReceiveName,
    HexString,
    EntrypointName,
    Energy,
} from '@concordium/web-sdk';
import { CONTRACT_ADDRESS, GRPC_ADDRESS, GRPC_PORT } from './constants';
import { useAsyncMemo } from './hooks';
import { TypedSmartContractParameters, WalletConnection } from '@concordium/wallet-connectors';

export * as ElectionContract from '../__generated__/election-contract/module_concordium_governance_committee_election';

interface ElectionContext {
    config: ElectionContract.ReturnValueViewConfig | undefined;
}

const initialContextValue: ElectionContext = { config: undefined };

const electionConfigContext = createContext<ElectionContext>(initialContextValue);
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

export function useElectionConfig() {
    const { config } = useContext(electionConfigContext);
    return config;
}

async function getElectionConfig() {
    const result = await ElectionContract.dryRunViewConfig(contract, Parameter.empty());
    return ElectionContract.parseReturnValueViewConfig(result);
}

export function ElectionContractProvider({ children }: PropsWithChildren) {
    const config: ElectionContract.ReturnValueViewConfig | undefined = useAsyncMemo(getElectionConfig, undefined, []);
    const contextValue: ElectionContext = useMemo(() => ({ config }), [config]);
    return <electionConfigContext.Provider value={contextValue}>{children}</electionConfigContext.Provider>;
}
