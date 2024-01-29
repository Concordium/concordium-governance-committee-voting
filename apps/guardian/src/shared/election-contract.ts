import { ConcordiumGRPCWebClient } from '@concordium/web-sdk/grpc';
import * as Contract from 'shared/election-contract';
import { CONTRACT_ADDRESS, GRPC_ADDRESS, GRPC_PORT } from './constants';
import {
    AccountAddress,
    AccountSigner,
    ContractTransactionMetadata,
    Energy,
    InvokeContractSuccessResult,
    Parameter,
    TransactionHash,
} from '@concordium/web-sdk';

const grpc = new ConcordiumGRPCWebClient(GRPC_ADDRESS, GRPC_PORT);
const contract = Contract.createUnchecked(grpc, CONTRACT_ADDRESS);

export type GuardiansState = Contract.ReturnValueViewGuardiansState;

/**
 * Gets the configuration of the election contract.
 * @returns A promise resolving with the corresponding {@linkcode Contract.ReturnValueViewConfig}
 */
export function getElectionConfig(): Promise<Contract.ReturnValueViewConfig | undefined> {
    return Contract.getElectionConfig(contract);
}

/**
 * Gets the current {@linkcode GuardiansState} as registered in the contract
 */
export async function getGuardiansState(): Promise<GuardiansState | undefined> {
    const result = await Contract.dryRunViewGuardiansState(contract, Parameter.empty());
    return Contract.parseReturnValueViewGuardiansState(result);
}

abstract class UpdateProposal<P> {
    private metadata: ContractTransactionMetadata;
    /**
     * The entrypoint to submit the update to
     */
    protected abstract entrypoint: (
        c: typeof contract,
        metadata: ContractTransactionMetadata,
        parameter: P,
        signer: AccountSigner,
    ) => Promise<TransactionHash.Type>;

    constructor(
        invocation: InvokeContractSuccessResult,
        private signer: AccountSigner,
        senderAddress: AccountAddress.Type,
        additionalEnergy: Energy.Type,
        private parameter: P,
    ) {
        this.metadata = {
            energy: Energy.create(invocation.usedEnergy.value + additionalEnergy.value),
            senderAddress,
        };
    }

    /**
     * The max amount of energy used for the transaction. Can be used to estimate the cost of the contract update.
     */
    public get energy(): Energy.Type {
        return this.metadata.energy;
    }

    /**
     * Submits the underlying contract update.
     *
     * @returns The transaction hash
     * @throws If the entrypoint could not be successfully invoked
     */
    public submit(): Promise<TransactionHash.Type> {
        return this.entrypoint(contract, this.metadata, this.parameter, this.signer);
    }
}

class RegisterGuardianPublicKeyProposal extends UpdateProposal<Contract.RegisterGuardianPublicKeyParameter> {
    protected entrypoint = Contract.sendRegisterGuardianPublicKey;
}

/**
 * Sends contract update with a guardian public key registration.
 *
 * @param transactionMetadata - The transaction metadata necessary for sending the transaction
 * @param publicKey - The public key to register
 * @param signer - The signer object holding the key(s) to create the transaction signature.
 *
 * @returns A {@linkcode RegisterGuardianPublicKeyProposal} which can be submitted
 * @throws If the entrypoint could not be successfully invoked
 */
export async function sendRegisterGuardianPublicKey(
    sender: AccountAddress.Type,
    publicKey: Contract.RegisterGuardianPublicKeyParameter,
    signer: AccountSigner,
): Promise<RegisterGuardianPublicKeyProposal> {
    const result = await Contract.dryRunRegisterGuardianPublicKey(contract, publicKey);

    if (result.tag === 'failure') {
        const error = Contract.parseErrorMessageRegisterGuardianPublicKey(result);
        throw new Error(`Could not register guardian public key: ${error?.type}`);
    }

    return new RegisterGuardianPublicKeyProposal(
        result,
        signer,
        sender,
        Energy.create(100), // Find a suitable value for this
        publicKey,
    );
}

/**
 * A hook which exposes a minimal interface for sending contract updates.
 */
export function useConnectedElectionContract() {
    // const account = useAtomValue(selectedAccountAtom);
    // const signer = useMemo(() => {
    //     if (account === undefined) {
    //         return undefined;
    //     }
    //
    //     return buildAccountSigner({accountKeys: account?.keys});
    // }, [account])
}
