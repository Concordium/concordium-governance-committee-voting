// @ts-nocheck
import * as SDK from "@concordium/web-sdk";

/** The reference of the smart contract module supported by the provided client. */
export const moduleReference: SDK.ModuleReference.Type = /*#__PURE__*/ SDK.ModuleReference.fromHexString('5aff02d76a742436b1831de7f0c801502ee514bc7aa6f3befb289f0b527c38cb');
/** Name of the smart contract supported by this client. */
export const contractName: SDK.ContractName.Type = /*#__PURE__*/ SDK.ContractName.fromStringUnchecked('election');

/** Smart contract client for a contract instance on chain. */
class ElectionContract {
    /** Having a private field prevents similar structured objects to be considered the same type (similar to nominal typing). */
    private __nominal = true;
    /** The gRPC connection used by this client. */
    public readonly grpcClient: SDK.ConcordiumGRPCClient;
    /** The contract address used by this client. */
    public readonly contractAddress: SDK.ContractAddress.Type;
    /** Generic contract client used internally. */
    public readonly genericContract: SDK.Contract;

    constructor(grpcClient: SDK.ConcordiumGRPCClient, contractAddress: SDK.ContractAddress.Type, genericContract: SDK.Contract) {
        this.grpcClient = grpcClient;
        this.contractAddress = contractAddress;
        this.genericContract = genericContract;
    }
}

/** Smart contract client for a contract instance on chain. */
export type Type = ElectionContract;

/**
 * Construct an instance of `ElectionContract` for interacting with a 'election' contract on chain.
 * Checking the information instance on chain.
 * @param {SDK.ConcordiumGRPCClient} grpcClient - The client used for contract invocations and updates.
 * @param {SDK.ContractAddress.Type} contractAddress - Address of the contract instance.
 * @param {SDK.BlockHash.Type} [blockHash] - Hash of the block to check the information at. When not provided the last finalized block is used.
 * @throws If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {ElectionContract}
 */
export async function create(grpcClient: SDK.ConcordiumGRPCClient, contractAddress: SDK.ContractAddress.Type, blockHash?: SDK.BlockHash.Type): Promise<ElectionContract> {
    const genericContract = new SDK.Contract(grpcClient, contractAddress, contractName);
    await genericContract.checkOnChain({ moduleReference: moduleReference, blockHash: blockHash });
    return new ElectionContract(
        grpcClient,
        contractAddress,
        genericContract
    );
}

/**
 * Construct the `ElectionContract` for interacting with a 'election' contract on chain.
 * Without checking the instance information on chain.
 * @param {SDK.ConcordiumGRPCClient} grpcClient - The client used for contract invocations and updates.
 * @param {SDK.ContractAddress.Type} contractAddress - Address of the contract instance.
 * @returns {ElectionContract}
 */
export function createUnchecked(grpcClient: SDK.ConcordiumGRPCClient, contractAddress: SDK.ContractAddress.Type): ElectionContract {
    const genericContract = new SDK.Contract(grpcClient, contractAddress, contractName);
    return new ElectionContract(
        grpcClient,
        contractAddress,
        genericContract,
    );
}

/**
 * Check if the smart contract instance exists on the blockchain and whether it uses a matching contract name and module reference.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.BlockHash.Type} [blockHash] A optional block hash to use for checking information on chain, if not provided the last finalized will be used.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 */
export function checkOnChain(contractClient: ElectionContract, blockHash?: SDK.BlockHash.Type): Promise<void> {
    return contractClient.genericContract.checkOnChain({moduleReference: moduleReference, blockHash: blockHash });
}

/** Parameter type for update transaction for 'registerGuardianPublicKey' entrypoint of the 'election' contract. */
export type RegisterGuardianPublicKeyParameter = Array<number>;

/**
 * Construct Parameter for update transactions for 'registerGuardianPublicKey' entrypoint of the 'election' contract.
 * @param {RegisterGuardianPublicKeyParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createRegisterGuardianPublicKeyParameter(parameter: RegisterGuardianPublicKeyParameter): SDK.Parameter.Type {
    const out = SDK.Parameter.fromBase64SchemaType('EAIC', parameter);
    return out;
}

/**
 * Send an update-contract transaction to the 'registerGuardianPublicKey' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {RegisterGuardianPublicKeyParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendRegisterGuardianPublicKey(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: RegisterGuardianPublicKeyParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('registerGuardianPublicKey'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createRegisterGuardianPublicKeyParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'registerGuardianPublicKey' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {RegisterGuardianPublicKeyParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunRegisterGuardianPublicKey(contractClient: ElectionContract, parameter: RegisterGuardianPublicKeyParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('registerGuardianPublicKey'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createRegisterGuardianPublicKeyParameter(parameter),
        blockHash
    );
}

/** Error message for dry-running update transaction for 'registerGuardianPublicKey' entrypoint of the 'election' contract. */
export type ErrorMessageRegisterGuardianPublicKey = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'registerGuardianPublicKey' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessageRegisterGuardianPublicKey | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessageRegisterGuardianPublicKey(invokeResult: SDK.InvokeContractResult): ErrorMessageRegisterGuardianPublicKey | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match35: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match35 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match35 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match35 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match35 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match35 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match35 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match35
}

/** Parameter type for update transaction for 'registerGuardianEncryptedShare' entrypoint of the 'election' contract. */
export type RegisterGuardianEncryptedShareParameter = Array<number>;

/**
 * Construct Parameter for update transactions for 'registerGuardianEncryptedShare' entrypoint of the 'election' contract.
 * @param {RegisterGuardianEncryptedShareParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createRegisterGuardianEncryptedShareParameter(parameter: RegisterGuardianEncryptedShareParameter): SDK.Parameter.Type {
    const out = SDK.Parameter.fromBase64SchemaType('EAIC', parameter);
    return out;
}

/**
 * Send an update-contract transaction to the 'registerGuardianEncryptedShare' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {RegisterGuardianEncryptedShareParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendRegisterGuardianEncryptedShare(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: RegisterGuardianEncryptedShareParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('registerGuardianEncryptedShare'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createRegisterGuardianEncryptedShareParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'registerGuardianEncryptedShare' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {RegisterGuardianEncryptedShareParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunRegisterGuardianEncryptedShare(contractClient: ElectionContract, parameter: RegisterGuardianEncryptedShareParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('registerGuardianEncryptedShare'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createRegisterGuardianEncryptedShareParameter(parameter),
        blockHash
    );
}

/** Error message for dry-running update transaction for 'registerGuardianEncryptedShare' entrypoint of the 'election' contract. */
export type ErrorMessageRegisterGuardianEncryptedShare = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'registerGuardianEncryptedShare' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessageRegisterGuardianEncryptedShare | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessageRegisterGuardianEncryptedShare(invokeResult: SDK.InvokeContractResult): ErrorMessageRegisterGuardianEncryptedShare | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match44: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match44 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match44 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match44 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match44 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match44 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match44 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match44
}

/** Parameter type for update transaction for 'postDecryptionShare' entrypoint of the 'election' contract. */
export type PostDecryptionShareParameter = Array<number>;

/**
 * Construct Parameter for update transactions for 'postDecryptionShare' entrypoint of the 'election' contract.
 * @param {PostDecryptionShareParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createPostDecryptionShareParameter(parameter: PostDecryptionShareParameter): SDK.Parameter.Type {
    const out = SDK.Parameter.fromBase64SchemaType('EAIC', parameter);
    return out;
}

/**
 * Send an update-contract transaction to the 'postDecryptionShare' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {PostDecryptionShareParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendPostDecryptionShare(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: PostDecryptionShareParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('postDecryptionShare'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createPostDecryptionShareParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'postDecryptionShare' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {PostDecryptionShareParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunPostDecryptionShare(contractClient: ElectionContract, parameter: PostDecryptionShareParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('postDecryptionShare'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createPostDecryptionShareParameter(parameter),
        blockHash
    );
}

/** Error message for dry-running update transaction for 'postDecryptionShare' entrypoint of the 'election' contract. */
export type ErrorMessagePostDecryptionShare = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'postDecryptionShare' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessagePostDecryptionShare | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessagePostDecryptionShare(invokeResult: SDK.InvokeContractResult): ErrorMessagePostDecryptionShare | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match53: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match53 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match53 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match53 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match53 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match53 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match53 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match53
}

/** Parameter type for update transaction for 'postDecryptionProofResponseShare' entrypoint of the 'election' contract. */
export type PostDecryptionProofResponseShareParameter = Array<number>;

/**
 * Construct Parameter for update transactions for 'postDecryptionProofResponseShare' entrypoint of the 'election' contract.
 * @param {PostDecryptionProofResponseShareParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createPostDecryptionProofResponseShareParameter(parameter: PostDecryptionProofResponseShareParameter): SDK.Parameter.Type {
    const out = SDK.Parameter.fromBase64SchemaType('EAIC', parameter);
    return out;
}

/**
 * Send an update-contract transaction to the 'postDecryptionProofResponseShare' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {PostDecryptionProofResponseShareParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendPostDecryptionProofResponseShare(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: PostDecryptionProofResponseShareParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('postDecryptionProofResponseShare'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createPostDecryptionProofResponseShareParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'postDecryptionProofResponseShare' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {PostDecryptionProofResponseShareParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunPostDecryptionProofResponseShare(contractClient: ElectionContract, parameter: PostDecryptionProofResponseShareParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('postDecryptionProofResponseShare'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createPostDecryptionProofResponseShareParameter(parameter),
        blockHash
    );
}

/** Error message for dry-running update transaction for 'postDecryptionProofResponseShare' entrypoint of the 'election' contract. */
export type ErrorMessagePostDecryptionProofResponseShare = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'postDecryptionProofResponseShare' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessagePostDecryptionProofResponseShare | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessagePostDecryptionProofResponseShare(invokeResult: SDK.InvokeContractResult): ErrorMessagePostDecryptionProofResponseShare | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match62: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match62 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match62 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match62 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match62 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match62 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match62 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match62
}

/** Parameter type for update transaction for 'registerGuardianStatus' entrypoint of the 'election' contract. */
export type RegisterGuardianStatusParameter = { type: 'KeyVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'SharesVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'VerificationSuccessful'};

/**
 * Construct Parameter for update transactions for 'registerGuardianStatus' entrypoint of the 'election' contract.
 * @param {RegisterGuardianStatusParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createRegisterGuardianStatusParameter(parameter: RegisterGuardianStatusParameter): SDK.Parameter.Type {
    let match69: {'KeyVerificationFailed' : [Array<SDK.AccountAddress.SchemaValue>] } | {'SharesVerificationFailed' : [Array<SDK.AccountAddress.SchemaValue>] } | {'VerificationSuccessful' : [] };
    switch (parameter.type) {
        case 'KeyVerificationFailed':
    const list70 = parameter.content.map((item71) => {
    const accountAddress72 = SDK.AccountAddress.toSchemaValue(item71);
    return accountAddress72;
    });
            match69 = { KeyVerificationFailed: [list70], };
        break;
        case 'SharesVerificationFailed':
    const list73 = parameter.content.map((item74) => {
    const accountAddress75 = SDK.AccountAddress.toSchemaValue(item74);
    return accountAddress75;
    });
            match69 = { SharesVerificationFailed: [list73], };
        break;
        case 'VerificationSuccessful':
            match69 = { VerificationSuccessful: [], };
        break;
    }
    const out = SDK.Parameter.fromBase64SchemaType('FQMAAAAVAAAAS2V5VmVyaWZpY2F0aW9uRmFpbGVkAQEAAAAQAgsYAAAAU2hhcmVzVmVyaWZpY2F0aW9uRmFpbGVkAQEAAAAQAgsWAAAAVmVyaWZpY2F0aW9uU3VjY2Vzc2Z1bAI=', match69);
    return out;
}

/**
 * Send an update-contract transaction to the 'registerGuardianStatus' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {RegisterGuardianStatusParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendRegisterGuardianStatus(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: RegisterGuardianStatusParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('registerGuardianStatus'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createRegisterGuardianStatusParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'registerGuardianStatus' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {RegisterGuardianStatusParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunRegisterGuardianStatus(contractClient: ElectionContract, parameter: RegisterGuardianStatusParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('registerGuardianStatus'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createRegisterGuardianStatusParameter(parameter),
        blockHash
    );
}

/** Error message for dry-running update transaction for 'registerGuardianStatus' entrypoint of the 'election' contract. */
export type ErrorMessageRegisterGuardianStatus = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'registerGuardianStatus' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessageRegisterGuardianStatus | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessageRegisterGuardianStatus(invokeResult: SDK.InvokeContractResult): ErrorMessageRegisterGuardianStatus | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match76: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match76 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match76 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match76 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match76 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match76 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match76 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match76
}

/** Parameter type for update transaction for 'viewGuardiansState' entrypoint of the 'election' contract. */
export type ViewGuardiansStateParameter = SDK.Parameter.Type;

/**
 * Construct Parameter for update transactions for 'viewGuardiansState' entrypoint of the 'election' contract.
 * @param {ViewGuardiansStateParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createViewGuardiansStateParameter(parameter: ViewGuardiansStateParameter): SDK.Parameter.Type {
    return parameter;
}

/**
 * Send an update-contract transaction to the 'viewGuardiansState' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {ViewGuardiansStateParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendViewGuardiansState(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: ViewGuardiansStateParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('viewGuardiansState'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createViewGuardiansStateParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'viewGuardiansState' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {ViewGuardiansStateParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunViewGuardiansState(contractClient: ElectionContract, parameter: ViewGuardiansStateParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('viewGuardiansState'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createViewGuardiansStateParameter(parameter),
        blockHash
    );
}

/** Return value for dry-running update transaction for 'viewGuardiansState' entrypoint of the 'election' contract. */
export type ReturnValueViewGuardiansState = Array<[SDK.AccountAddress.Type, {
    index: number,
    public_key: { type: 'None'} | { type: 'Some', content: Array<number> },
    encrypted_share: { type: 'None'} | { type: 'Some', content: Array<number> },
    decryption_share: { type: 'None'} | { type: 'Some', content: Array<number> },
    decryption_share_proof: { type: 'None'} | { type: 'Some', content: Array<number> },
    status: { type: 'None'} | { type: 'Some', content: { type: 'KeyVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'SharesVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'VerificationSuccessful'} },
    excluded: boolean,
    }]>;

/**
 * Get and parse the return value from dry-running update transaction for 'viewGuardiansState' entrypoint of the 'election' contract.
 * Returns undefined if the result is not successful.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ReturnValueViewGuardiansState | undefined} The structured return value or undefined if result was not a success.
 */
export function parseReturnValueViewGuardiansState(invokeResult: SDK.InvokeContractResult): ReturnValueViewGuardiansState | undefined {
    if (invokeResult.tag !== 'success') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <Array<[SDK.AccountAddress.SchemaValue, {
    index: number,
    public_key: {'None' : [] } | {'Some' : [Array<number>] },
    encrypted_share: {'None' : [] } | {'Some' : [Array<number>] },
    decryption_share: {'None' : [] } | {'Some' : [Array<number>] },
    decryption_share_proof: {'None' : [] } | {'Some' : [Array<number>] },
    status: {'None' : [] } | {'Some' : [{'KeyVerificationFailed' : [Array<SDK.AccountAddress.SchemaValue>] } | {'SharesVerificationFailed' : [Array<SDK.AccountAddress.SchemaValue>] } | {'VerificationSuccessful' : [] }] },
    excluded: boolean,
    }]>>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'EAIPCxQABwAAAAUAAABpbmRleAQKAAAAcHVibGljX2tleRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABACAg8AAABlbmNyeXB0ZWRfc2hhcmUVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAAQAgIQAAAAZGVjcnlwdGlvbl9zaGFyZRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABACAhYAAABkZWNyeXB0aW9uX3NoYXJlX3Byb29mFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAEAICBgAAAHN0YXR1cxUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABUDAAAAFQAAAEtleVZlcmlmaWNhdGlvbkZhaWxlZAEBAAAAEAILGAAAAFNoYXJlc1ZlcmlmaWNhdGlvbkZhaWxlZAEBAAAAEAILFgAAAFZlcmlmaWNhdGlvblN1Y2Nlc3NmdWwCCAAAAGV4Y2x1ZGVkAQ==');
    const list83 = schemaJson.map((item84) => {
    const accountAddress86 = SDK.AccountAddress.fromSchemaValue(item84[0]);
    const field87 = item84[1].index;
    const field88 = item84[1].public_key;
    let match89: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field88) {
       match89 = {
           type: 'None',
       };
    } else if ('Some' in field88) {
       const variant91 = field88.Some;
       match89 = {
           type: 'Some',
           content: variant91[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field94 = item84[1].encrypted_share;
    let match95: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field94) {
       match95 = {
           type: 'None',
       };
    } else if ('Some' in field94) {
       const variant97 = field94.Some;
       match95 = {
           type: 'Some',
           content: variant97[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field100 = item84[1].decryption_share;
    let match101: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field100) {
       match101 = {
           type: 'None',
       };
    } else if ('Some' in field100) {
       const variant103 = field100.Some;
       match101 = {
           type: 'Some',
           content: variant103[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field106 = item84[1].decryption_share_proof;
    let match107: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field106) {
       match107 = {
           type: 'None',
       };
    } else if ('Some' in field106) {
       const variant109 = field106.Some;
       match107 = {
           type: 'Some',
           content: variant109[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field112 = item84[1].status;
    let match113: { type: 'None'} | { type: 'Some', content: { type: 'KeyVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'SharesVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'VerificationSuccessful'} };
    if ('None' in field112) {
       match113 = {
           type: 'None',
       };
    } else if ('Some' in field112) {
       const variant115 = field112.Some;
    let match116: { type: 'KeyVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'SharesVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'VerificationSuccessful'};
    if ('KeyVerificationFailed' in variant115[0]) {
       const variant117 = variant115[0].KeyVerificationFailed;
    const list118 = variant117[0].map((item119) => {
    const accountAddress120 = SDK.AccountAddress.fromSchemaValue(item119);
    return accountAddress120;
    });
       match116 = {
           type: 'KeyVerificationFailed',
           content: list118,
       };
    } else if ('SharesVerificationFailed' in variant115[0]) {
       const variant121 = variant115[0].SharesVerificationFailed;
    const list122 = variant121[0].map((item123) => {
    const accountAddress124 = SDK.AccountAddress.fromSchemaValue(item123);
    return accountAddress124;
    });
       match116 = {
           type: 'SharesVerificationFailed',
           content: list122,
       };
    } else if ('VerificationSuccessful' in variant115[0]) {
       match116 = {
           type: 'VerificationSuccessful',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
       match113 = {
           type: 'Some',
           content: match116,
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field126 = item84[1].excluded;
    const named127 = {
    index: field87,
    public_key: match89,
    encrypted_share: match95,
    decryption_share: match101,
    decryption_share_proof: match107,
    status: match113,
    excluded: field126,
    };
    const pair85: [SDK.AccountAddress.Type, {
    index: number,
    public_key: { type: 'None'} | { type: 'Some', content: Array<number> },
    encrypted_share: { type: 'None'} | { type: 'Some', content: Array<number> },
    decryption_share: { type: 'None'} | { type: 'Some', content: Array<number> },
    decryption_share_proof: { type: 'None'} | { type: 'Some', content: Array<number> },
    status: { type: 'None'} | { type: 'Some', content: { type: 'KeyVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'SharesVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'VerificationSuccessful'} },
    excluded: boolean,
    }] = [accountAddress86, named127];
    return pair85;
    });
    return list83;
}

/** Parameter type for update transaction for 'registerVotes' entrypoint of the 'election' contract. */
export type RegisterVotesParameter = Array<number>;

/**
 * Construct Parameter for update transactions for 'registerVotes' entrypoint of the 'election' contract.
 * @param {RegisterVotesParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createRegisterVotesParameter(parameter: RegisterVotesParameter): SDK.Parameter.Type {
    const out = SDK.Parameter.fromBase64SchemaType('EAIC', parameter);
    return out;
}

/**
 * Send an update-contract transaction to the 'registerVotes' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {RegisterVotesParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendRegisterVotes(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: RegisterVotesParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('registerVotes'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createRegisterVotesParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'registerVotes' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {RegisterVotesParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunRegisterVotes(contractClient: ElectionContract, parameter: RegisterVotesParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('registerVotes'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createRegisterVotesParameter(parameter),
        blockHash
    );
}

/** Error message for dry-running update transaction for 'registerVotes' entrypoint of the 'election' contract. */
export type ErrorMessageRegisterVotes = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'registerVotes' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessageRegisterVotes | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessageRegisterVotes(invokeResult: SDK.InvokeContractResult): ErrorMessageRegisterVotes | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match130: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match130 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match130 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match130 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match130 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match130 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match130 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match130
}

/** Parameter type for update transaction for 'postEncryptedTally' entrypoint of the 'election' contract. */
export type PostEncryptedTallyParameter = Array<number>;

/**
 * Construct Parameter for update transactions for 'postEncryptedTally' entrypoint of the 'election' contract.
 * @param {PostEncryptedTallyParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createPostEncryptedTallyParameter(parameter: PostEncryptedTallyParameter): SDK.Parameter.Type {
    const out = SDK.Parameter.fromBase64SchemaType('EAIC', parameter);
    return out;
}

/**
 * Send an update-contract transaction to the 'postEncryptedTally' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {PostEncryptedTallyParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendPostEncryptedTally(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: PostEncryptedTallyParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('postEncryptedTally'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createPostEncryptedTallyParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'postEncryptedTally' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {PostEncryptedTallyParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunPostEncryptedTally(contractClient: ElectionContract, parameter: PostEncryptedTallyParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('postEncryptedTally'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createPostEncryptedTallyParameter(parameter),
        blockHash
    );
}

/** Error message for dry-running update transaction for 'postEncryptedTally' entrypoint of the 'election' contract. */
export type ErrorMessagePostEncryptedTally = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'postEncryptedTally' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessagePostEncryptedTally | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessagePostEncryptedTally(invokeResult: SDK.InvokeContractResult): ErrorMessagePostEncryptedTally | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match139: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match139 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match139 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match139 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match139 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match139 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match139 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match139
}

/** Parameter type for update transaction for 'postElectionResult' entrypoint of the 'election' contract. */
export type PostElectionResultParameter = Array<number | bigint>;

/**
 * Construct Parameter for update transactions for 'postElectionResult' entrypoint of the 'election' contract.
 * @param {PostElectionResultParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createPostElectionResultParameter(parameter: PostElectionResultParameter): SDK.Parameter.Type {
    const list146 = parameter.map((item147) => {
    const number148 = BigInt(item147);
    return number148;
    });
    const out = SDK.Parameter.fromBase64SchemaType('EAIF', list146);
    return out;
}

/**
 * Send an update-contract transaction to the 'postElectionResult' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {PostElectionResultParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendPostElectionResult(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: PostElectionResultParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('postElectionResult'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createPostElectionResultParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'postElectionResult' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {PostElectionResultParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunPostElectionResult(contractClient: ElectionContract, parameter: PostElectionResultParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('postElectionResult'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createPostElectionResultParameter(parameter),
        blockHash
    );
}

/** Error message for dry-running update transaction for 'postElectionResult' entrypoint of the 'election' contract. */
export type ErrorMessagePostElectionResult = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'postElectionResult' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessagePostElectionResult | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessagePostElectionResult(invokeResult: SDK.InvokeContractResult): ErrorMessagePostElectionResult | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match149: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match149 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match149 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match149 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match149 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match149 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match149 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match149
}

/** Parameter type for update transaction for 'resetFinalizationPhase' entrypoint of the 'election' contract. */
export type ResetFinalizationPhaseParameter = [Array<SDK.AccountAddress.Type>, SDK.Timestamp.Type];

/**
 * Construct Parameter for update transactions for 'resetFinalizationPhase' entrypoint of the 'election' contract.
 * @param {ResetFinalizationPhaseParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createResetFinalizationPhaseParameter(parameter: ResetFinalizationPhaseParameter): SDK.Parameter.Type {
    const list157 = parameter[0].map((item158) => {
    const accountAddress159 = SDK.AccountAddress.toSchemaValue(item158);
    return accountAddress159;
    });
    const timestamp160 = SDK.Timestamp.toSchemaValue(parameter[1]);
    const pair156: [Array<SDK.AccountAddress.SchemaValue>, SDK.Timestamp.SchemaValue] = [list157, timestamp160];
    const out = SDK.Parameter.fromBase64SchemaType('DxACCw0=', pair156);
    return out;
}

/**
 * Send an update-contract transaction to the 'resetFinalizationPhase' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {ResetFinalizationPhaseParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendResetFinalizationPhase(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: ResetFinalizationPhaseParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('resetFinalizationPhase'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createResetFinalizationPhaseParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'resetFinalizationPhase' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {ResetFinalizationPhaseParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunResetFinalizationPhase(contractClient: ElectionContract, parameter: ResetFinalizationPhaseParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('resetFinalizationPhase'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createResetFinalizationPhaseParameter(parameter),
        blockHash
    );
}

/** Error message for dry-running update transaction for 'resetFinalizationPhase' entrypoint of the 'election' contract. */
export type ErrorMessageResetFinalizationPhase = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'resetFinalizationPhase' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessageResetFinalizationPhase | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessageResetFinalizationPhase(invokeResult: SDK.InvokeContractResult): ErrorMessageResetFinalizationPhase | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match161: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match161 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match161 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match161 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match161 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match161 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match161 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match161
}

/** Parameter type for update transaction for 'viewConfig' entrypoint of the 'election' contract. */
export type ViewConfigParameter = SDK.Parameter.Type;

/**
 * Construct Parameter for update transactions for 'viewConfig' entrypoint of the 'election' contract.
 * @param {ViewConfigParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createViewConfigParameter(parameter: ViewConfigParameter): SDK.Parameter.Type {
    return parameter;
}

/**
 * Send an update-contract transaction to the 'viewConfig' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {ViewConfigParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendViewConfig(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: ViewConfigParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('viewConfig'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createViewConfigParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'viewConfig' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {ViewConfigParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunViewConfig(contractClient: ElectionContract, parameter: ViewConfigParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('viewConfig'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createViewConfigParameter(parameter),
        blockHash
    );
}

/** Return value for dry-running update transaction for 'viewConfig' entrypoint of the 'election' contract. */
export type ReturnValueViewConfig = {
    admin_account: SDK.AccountAddress.Type,
    candidates: Array<{
    url: string,
    hash: SDK.HexString,
    }>,
    guardian_keys: Array<Array<number>>,
    eligible_voters: {
    url: string,
    hash: SDK.HexString,
    },
    election_manifest: {
    url: string,
    hash: SDK.HexString,
    },
    election_parameters: {
    url: string,
    hash: SDK.HexString,
    },
    election_description: string,
    election_start: SDK.Timestamp.Type,
    election_end: SDK.Timestamp.Type,
    decryption_deadline: SDK.Timestamp.Type,
    delegation_string: string,
    };

/**
 * Get and parse the return value from dry-running update transaction for 'viewConfig' entrypoint of the 'election' contract.
 * Returns undefined if the result is not successful.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ReturnValueViewConfig | undefined} The structured return value or undefined if result was not a success.
 */
export function parseReturnValueViewConfig(invokeResult: SDK.InvokeContractResult): ReturnValueViewConfig | undefined {
    if (invokeResult.tag !== 'success') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{
    admin_account: SDK.AccountAddress.SchemaValue,
    candidates: Array<{
    url: string,
    hash: string,
    }>,
    guardian_keys: Array<Array<number>>,
    eligible_voters: {
    url: string,
    hash: string,
    },
    election_manifest: {
    url: string,
    hash: string,
    },
    election_parameters: {
    url: string,
    hash: string,
    },
    election_description: string,
    election_start: SDK.Timestamp.SchemaValue,
    election_end: SDK.Timestamp.SchemaValue,
    decryption_deadline: SDK.Timestamp.SchemaValue,
    delegation_string: string,
    }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FAALAAAADQAAAGFkbWluX2FjY291bnQLCgAAAGNhbmRpZGF0ZXMQAhQAAgAAAAMAAAB1cmwWAgQAAABoYXNoHiAAAAANAAAAZ3VhcmRpYW5fa2V5cxACEAICDwAAAGVsaWdpYmxlX3ZvdGVycxQAAgAAAAMAAAB1cmwWAgQAAABoYXNoHiAAAAARAAAAZWxlY3Rpb25fbWFuaWZlc3QUAAIAAAADAAAAdXJsFgIEAAAAaGFzaB4gAAAAEwAAAGVsZWN0aW9uX3BhcmFtZXRlcnMUAAIAAAADAAAAdXJsFgIEAAAAaGFzaB4gAAAAFAAAAGVsZWN0aW9uX2Rlc2NyaXB0aW9uFgIOAAAAZWxlY3Rpb25fc3RhcnQNDAAAAGVsZWN0aW9uX2VuZA0TAAAAZGVjcnlwdGlvbl9kZWFkbGluZQ0RAAAAZGVsZWdhdGlvbl9zdHJpbmcWAg==');
    const field168 = schemaJson.admin_account;
    const accountAddress169 = SDK.AccountAddress.fromSchemaValue(field168);
    const field170 = schemaJson.candidates;
    const list171 = field170.map((item172) => {
    const field173 = item172.url;
    const field174 = item172.hash;
    const named175 = {
    url: field173,
    hash: field174,
    };
    return named175;
    });
    const field176 = schemaJson.guardian_keys;
    const field181 = schemaJson.eligible_voters;
    const field182 = field181.url;
    const field183 = field181.hash;
    const named184 = {
    url: field182,
    hash: field183,
    };
    const field185 = schemaJson.election_manifest;
    const field186 = field185.url;
    const field187 = field185.hash;
    const named188 = {
    url: field186,
    hash: field187,
    };
    const field189 = schemaJson.election_parameters;
    const field190 = field189.url;
    const field191 = field189.hash;
    const named192 = {
    url: field190,
    hash: field191,
    };
    const field193 = schemaJson.election_description;
    const field194 = schemaJson.election_start;
    const timestamp195 = SDK.Timestamp.fromSchemaValue(field194);
    const field196 = schemaJson.election_end;
    const timestamp197 = SDK.Timestamp.fromSchemaValue(field196);
    const field198 = schemaJson.decryption_deadline;
    const timestamp199 = SDK.Timestamp.fromSchemaValue(field198);
    const field200 = schemaJson.delegation_string;
    const named201 = {
    admin_account: accountAddress169,
    candidates: list171,
    guardian_keys: field176,
    eligible_voters: named184,
    election_manifest: named188,
    election_parameters: named192,
    election_description: field193,
    election_start: timestamp195,
    election_end: timestamp197,
    decryption_deadline: timestamp199,
    delegation_string: field200,
    };
    return named201;
}

/** Parameter type for update transaction for 'viewElectionResult' entrypoint of the 'election' contract. */
export type ViewElectionResultParameter = SDK.Parameter.Type;

/**
 * Construct Parameter for update transactions for 'viewElectionResult' entrypoint of the 'election' contract.
 * @param {ViewElectionResultParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createViewElectionResultParameter(parameter: ViewElectionResultParameter): SDK.Parameter.Type {
    return parameter;
}

/**
 * Send an update-contract transaction to the 'viewElectionResult' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {ViewElectionResultParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendViewElectionResult(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: ViewElectionResultParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('viewElectionResult'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createViewElectionResultParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'viewElectionResult' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {ViewElectionResultParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunViewElectionResult(contractClient: ElectionContract, parameter: ViewElectionResultParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('viewElectionResult'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createViewElectionResultParameter(parameter),
        blockHash
    );
}

/** Return value for dry-running update transaction for 'viewElectionResult' entrypoint of the 'election' contract. */
export type ReturnValueViewElectionResult = { type: 'None'} | { type: 'Some', content: Array<{
    candidate: {
    url: string,
    hash: SDK.HexString,
    },
    cummulative_votes: number | bigint,
    }> };

/**
 * Get and parse the return value from dry-running update transaction for 'viewElectionResult' entrypoint of the 'election' contract.
 * Returns undefined if the result is not successful.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ReturnValueViewElectionResult | undefined} The structured return value or undefined if result was not a success.
 */
export function parseReturnValueViewElectionResult(invokeResult: SDK.InvokeContractResult): ReturnValueViewElectionResult | undefined {
    if (invokeResult.tag !== 'success') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'None' : [] } | {'Some' : [Array<{
    candidate: {
    url: string,
    hash: string,
    },
    cummulative_votes: bigint,
    }>] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAEAIUAAIAAAAJAAAAY2FuZGlkYXRlFAACAAAAAwAAAHVybBYCBAAAAGhhc2geIAAAABEAAABjdW1tdWxhdGl2ZV92b3RlcwU=');
    let match202: { type: 'None'} | { type: 'Some', content: Array<{
    candidate: {
    url: string,
    hash: SDK.HexString,
    },
    cummulative_votes: number | bigint,
    }> };
    if ('None' in schemaJson) {
       match202 = {
           type: 'None',
       };
    } else if ('Some' in schemaJson) {
       const variant204 = schemaJson.Some;
    const list205 = variant204[0].map((item206) => {
    const field207 = item206.candidate;
    const field208 = field207.url;
    const field209 = field207.hash;
    const named210 = {
    url: field208,
    hash: field209,
    };
    const field211 = item206.cummulative_votes;
    const named212 = {
    candidate: named210,
    cummulative_votes: field211,
    };
    return named212;
    });
       match202 = {
           type: 'Some',
           content: list205,
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match202;
}

/** Error message for dry-running update transaction for 'viewElectionResult' entrypoint of the 'election' contract. */
export type ErrorMessageViewElectionResult = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'viewElectionResult' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessageViewElectionResult | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessageViewElectionResult(invokeResult: SDK.InvokeContractResult): ErrorMessageViewElectionResult | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match213: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match213 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match213 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match213 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match213 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match213 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match213 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match213
}

/** Parameter type for update transaction for 'viewEncryptedTally' entrypoint of the 'election' contract. */
export type ViewEncryptedTallyParameter = SDK.Parameter.Type;

/**
 * Construct Parameter for update transactions for 'viewEncryptedTally' entrypoint of the 'election' contract.
 * @param {ViewEncryptedTallyParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createViewEncryptedTallyParameter(parameter: ViewEncryptedTallyParameter): SDK.Parameter.Type {
    return parameter;
}

/**
 * Send an update-contract transaction to the 'viewEncryptedTally' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractTransactionMetadata} transactionMetadata - Metadata related to constructing a transaction for a smart contract.
 * @param {ViewEncryptedTallyParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.AccountSigner} signer - The signer of the update contract transaction.
 * @throws If the entrypoint is not successfully invoked.
 * @returns {SDK.TransactionHash.Type} Hash of the transaction.
 */
export function sendViewEncryptedTally(contractClient: ElectionContract, transactionMetadata: SDK.ContractTransactionMetadata, parameter: ViewEncryptedTallyParameter, signer: SDK.AccountSigner): Promise<SDK.TransactionHash.Type> {
    return contractClient.genericContract.createAndSendUpdateTransaction(
        SDK.EntrypointName.fromStringUnchecked('viewEncryptedTally'),
        SDK.Parameter.toBuffer,
        transactionMetadata,
        createViewEncryptedTallyParameter(parameter),
        signer
    );
}

/**
 * Dry-run an update-contract transaction to the 'viewEncryptedTally' entrypoint of the 'election' contract.
 * @param {ElectionContract} contractClient The client for a 'election' smart contract instance on chain.
 * @param {SDK.ContractAddress.Type | SDK.AccountAddress.Type} invokeMetadata - The address of the account or contract which is invoking this transaction.
 * @param {ViewEncryptedTallyParameter} parameter - Parameter to provide the smart contract entrypoint as part of the transaction.
 * @param {SDK.BlockHash.Type} [blockHash] - Optional block hash allowing for dry-running the transaction at the end of a specific block.
 * @throws {SDK.RpcError} If failing to communicate with the concordium node or if any of the checks fails.
 * @returns {SDK.InvokeContractResult} The result of invoking the smart contract instance.
 */
export function dryRunViewEncryptedTally(contractClient: ElectionContract, parameter: ViewEncryptedTallyParameter, invokeMetadata: SDK.ContractInvokeMetadata = {}, blockHash?: SDK.BlockHash.Type): Promise<SDK.InvokeContractResult> {
    return contractClient.genericContract.dryRun.invokeMethod(
        SDK.EntrypointName.fromStringUnchecked('viewEncryptedTally'),
        invokeMetadata,
        SDK.Parameter.toBuffer,
        createViewEncryptedTallyParameter(parameter),
        blockHash
    );
}

/** Return value for dry-running update transaction for 'viewEncryptedTally' entrypoint of the 'election' contract. */
export type ReturnValueViewEncryptedTally = { type: 'None'} | { type: 'Some', content: Array<number> };

/**
 * Get and parse the return value from dry-running update transaction for 'viewEncryptedTally' entrypoint of the 'election' contract.
 * Returns undefined if the result is not successful.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ReturnValueViewEncryptedTally | undefined} The structured return value or undefined if result was not a success.
 */
export function parseReturnValueViewEncryptedTally(invokeResult: SDK.InvokeContractResult): ReturnValueViewEncryptedTally | undefined {
    if (invokeResult.tag !== 'success') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'None' : [] } | {'Some' : [Array<number>] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAEAIC');
    let match220: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in schemaJson) {
       match220 = {
           type: 'None',
       };
    } else if ('Some' in schemaJson) {
       const variant222 = schemaJson.Some;
       match220 = {
           type: 'Some',
           content: variant222[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match220;
}

/** Error message for dry-running update transaction for 'viewEncryptedTally' entrypoint of the 'election' contract. */
export type ErrorMessageViewEncryptedTally = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};

/**
 * Get and parse the error message from dry-running update transaction for 'viewEncryptedTally' entrypoint of the 'election' contract.
 * Returns undefined if the result is not a failure.
 * @param {SDK.InvokeContractResult} invokeResult The result from dry-running the transaction.
 * @returns {ErrorMessageViewEncryptedTally | undefined} The structured error message or undefined if result was not a failure or failed for other reason than contract rejectedReceive.
 */
export function parseErrorMessageViewEncryptedTally(invokeResult: SDK.InvokeContractResult): ErrorMessageViewEncryptedTally | undefined {
    if (invokeResult.tag !== 'failure' || invokeResult.reason.tag !== 'RejectedReceive') {
        return undefined;
    }
    if (invokeResult.returnValue === undefined) {
        throw new Error('Unexpected missing \'returnValue\' in result of invocation. Client expected a V1 smart contract.');
    }
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] } | {'GuardianExcluded' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQIQAAAAR3VhcmRpYW5FeGNsdWRlZAI=');
    let match225: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match225 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match225 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match225 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match225 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match225 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match225 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match225
}
