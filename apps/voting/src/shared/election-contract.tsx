import { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import * as ElectionContract from '../__generated__/election-contract/module_concordium_governance_committee_election';
import { ConcordiumGRPCWebClient, Parameter } from '@concordium/web-sdk';
import { CONTRACT_ADDRESS, GRPC_ADDRESS, GRPC_PORT } from './constants';
import { useAsyncMemo } from './hooks';

interface ElectionContext {
    config: ElectionContract.ReturnValueViewConfig | undefined;
}

const initialContextValue: ElectionContext = { config: undefined };

const electionConfigContext = createContext<ElectionContext>(initialContextValue);
const grpc = new ConcordiumGRPCWebClient(GRPC_ADDRESS, GRPC_PORT);
const contract = ElectionContract.createUnchecked(grpc, CONTRACT_ADDRESS);

export function useElectionConfig() {
    const {config} = useContext(electionConfigContext);
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
