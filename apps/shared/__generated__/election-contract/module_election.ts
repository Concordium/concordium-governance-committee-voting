// @ts-nocheck
import * as SDK from "@concordium/web-sdk";

/** The reference of the smart contract module supported by the provided client. */
export const moduleReference: SDK.ModuleReference.Type = /*#__PURE__*/ SDK.ModuleReference.fromHexString('b369afbe30f94abe6bae05ccd79769f9615758c73937f297e7bfdedc45088154');
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
    let match43: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match43 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match43 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match43 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match43 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match43 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match43 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match43
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
    let match52: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match52 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match52 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match52 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match52 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match52 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match52 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match52
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
    let match61: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match61 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match61 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match61 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match61 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match61 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match61 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match61
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
    let match70: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match70 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match70 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match70 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match70 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match70 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match70 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match70
}

/** Parameter type for update transaction for 'registerGuardianStatus' entrypoint of the 'election' contract. */
export type RegisterGuardianStatusParameter = { type: 'KeyVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'SharesVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'VerificationSuccessful'};

/**
 * Construct Parameter for update transactions for 'registerGuardianStatus' entrypoint of the 'election' contract.
 * @param {RegisterGuardianStatusParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createRegisterGuardianStatusParameter(parameter: RegisterGuardianStatusParameter): SDK.Parameter.Type {
    let match77: {'KeyVerificationFailed' : [Array<SDK.AccountAddress.SchemaValue>] } | {'SharesVerificationFailed' : [Array<SDK.AccountAddress.SchemaValue>] } | {'VerificationSuccessful' : [] };
    switch (parameter.type) {
        case 'KeyVerificationFailed':
    const list78 = parameter.content.map((item79) => {
    const accountAddress80 = SDK.AccountAddress.toSchemaValue(item79);
    return accountAddress80;
    });
            match77 = { KeyVerificationFailed: [list78], };
        break;
        case 'SharesVerificationFailed':
    const list81 = parameter.content.map((item82) => {
    const accountAddress83 = SDK.AccountAddress.toSchemaValue(item82);
    return accountAddress83;
    });
            match77 = { SharesVerificationFailed: [list81], };
        break;
        case 'VerificationSuccessful':
            match77 = { VerificationSuccessful: [], };
        break;
    }
    const out = SDK.Parameter.fromBase64SchemaType('FQMAAAAVAAAAS2V5VmVyaWZpY2F0aW9uRmFpbGVkAQEAAAAQAgsYAAAAU2hhcmVzVmVyaWZpY2F0aW9uRmFpbGVkAQEAAAAQAgsWAAAAVmVyaWZpY2F0aW9uU3VjY2Vzc2Z1bAI=', match77);
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
    let match84: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match84 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match84 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match84 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match84 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match84 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match84 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match84
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
    const list91 = schemaJson.map((item92) => {
    const accountAddress94 = SDK.AccountAddress.fromSchemaValue(item92[0]);
    const field95 = item92[1].index;
    const field96 = item92[1].public_key;
    let match97: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field96) {
       match97 = {
           type: 'None',
       };
    } else if ('Some' in field96) {
       const variant99 = field96.Some;
       match97 = {
           type: 'Some',
           content: variant99[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field102 = item92[1].encrypted_share;
    let match103: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field102) {
       match103 = {
           type: 'None',
       };
    } else if ('Some' in field102) {
       const variant105 = field102.Some;
       match103 = {
           type: 'Some',
           content: variant105[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field108 = item92[1].decryption_share;
    let match109: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field108) {
       match109 = {
           type: 'None',
       };
    } else if ('Some' in field108) {
       const variant111 = field108.Some;
       match109 = {
           type: 'Some',
           content: variant111[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field114 = item92[1].decryption_share_proof;
    let match115: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field114) {
       match115 = {
           type: 'None',
       };
    } else if ('Some' in field114) {
       const variant117 = field114.Some;
       match115 = {
           type: 'Some',
           content: variant117[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field120 = item92[1].status;
    let match121: { type: 'None'} | { type: 'Some', content: { type: 'KeyVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'SharesVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'VerificationSuccessful'} };
    if ('None' in field120) {
       match121 = {
           type: 'None',
       };
    } else if ('Some' in field120) {
       const variant123 = field120.Some;
    let match124: { type: 'KeyVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'SharesVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'VerificationSuccessful'};
    if ('KeyVerificationFailed' in variant123[0]) {
       const variant125 = variant123[0].KeyVerificationFailed;
    const list126 = variant125[0].map((item127) => {
    const accountAddress128 = SDK.AccountAddress.fromSchemaValue(item127);
    return accountAddress128;
    });
       match124 = {
           type: 'KeyVerificationFailed',
           content: list126,
       };
    } else if ('SharesVerificationFailed' in variant123[0]) {
       const variant129 = variant123[0].SharesVerificationFailed;
    const list130 = variant129[0].map((item131) => {
    const accountAddress132 = SDK.AccountAddress.fromSchemaValue(item131);
    return accountAddress132;
    });
       match124 = {
           type: 'SharesVerificationFailed',
           content: list130,
       };
    } else if ('VerificationSuccessful' in variant123[0]) {
       match124 = {
           type: 'VerificationSuccessful',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
       match121 = {
           type: 'Some',
           content: match124,
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field134 = item92[1].excluded;
    const named135 = {
    index: field95,
    public_key: match97,
    encrypted_share: match103,
    decryption_share: match109,
    decryption_share_proof: match115,
    status: match121,
    excluded: field134,
    };
    const pair93: [SDK.AccountAddress.Type, {
    index: number,
    public_key: { type: 'None'} | { type: 'Some', content: Array<number> },
    encrypted_share: { type: 'None'} | { type: 'Some', content: Array<number> },
    decryption_share: { type: 'None'} | { type: 'Some', content: Array<number> },
    decryption_share_proof: { type: 'None'} | { type: 'Some', content: Array<number> },
    status: { type: 'None'} | { type: 'Some', content: { type: 'KeyVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'SharesVerificationFailed', content: Array<SDK.AccountAddress.Type> } | { type: 'VerificationSuccessful'} },
    excluded: boolean,
    }] = [accountAddress94, named135];
    return pair93;
    });
    return list91;
}

/** Parameter type for update transaction for 'registerVotes' entrypoint of the 'election' contract. */
export type RegisterVotesParameter = SDK.HexString;

/**
 * Construct Parameter for update transactions for 'registerVotes' entrypoint of the 'election' contract.
 * @param {RegisterVotesParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createRegisterVotesParameter(parameter: RegisterVotesParameter): SDK.Parameter.Type {
    const out = SDK.Parameter.fromBase64SchemaType('HQI=', parameter);
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
    let match136: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match136 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match136 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match136 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match136 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match136 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match136 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match136
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
    let match145: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match145 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match145 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match145 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match145 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match145 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match145 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match145
}

/** Parameter type for update transaction for 'postElectionResult' entrypoint of the 'election' contract. */
export type PostElectionResultParameter = Array<number | bigint>;

/**
 * Construct Parameter for update transactions for 'postElectionResult' entrypoint of the 'election' contract.
 * @param {PostElectionResultParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createPostElectionResultParameter(parameter: PostElectionResultParameter): SDK.Parameter.Type {
    const list152 = parameter.map((item153) => {
    const number154 = BigInt(item153);
    return number154;
    });
    const out = SDK.Parameter.fromBase64SchemaType('EAIF', list152);
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
    let match155: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match155 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match155 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match155 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match155 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match155 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match155 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match155
}

/** Parameter type for update transaction for 'resetFinalizationPhase' entrypoint of the 'election' contract. */
export type ResetFinalizationPhaseParameter = [Array<SDK.AccountAddress.Type>, SDK.Timestamp.Type];

/**
 * Construct Parameter for update transactions for 'resetFinalizationPhase' entrypoint of the 'election' contract.
 * @param {ResetFinalizationPhaseParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createResetFinalizationPhaseParameter(parameter: ResetFinalizationPhaseParameter): SDK.Parameter.Type {
    const list163 = parameter[0].map((item164) => {
    const accountAddress165 = SDK.AccountAddress.toSchemaValue(item164);
    return accountAddress165;
    });
    const timestamp166 = SDK.Timestamp.toSchemaValue(parameter[1]);
    const pair162: [Array<SDK.AccountAddress.SchemaValue>, SDK.Timestamp.SchemaValue] = [list163, timestamp166];
    const out = SDK.Parameter.fromBase64SchemaType('DxACCw0=', pair162);
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
    let match167: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match167 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match167 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match167 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match167 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match167 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match167 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match167
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
    guardian_accounts: Array<SDK.AccountAddress.Type>,
    eligible_voters: {
    parameters: {
    start_time: SDK.Timestamp.Type,
    end_time: SDK.Timestamp.Type,
    },
    data: {
    url: string,
    hash: SDK.HexString,
    },
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
    guardian_accounts: Array<SDK.AccountAddress.SchemaValue>,
    eligible_voters: {
    parameters: {
    start_time: SDK.Timestamp.SchemaValue,
    end_time: SDK.Timestamp.SchemaValue,
    },
    data: {
    url: string,
    hash: string,
    },
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
    }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FAALAAAADQAAAGFkbWluX2FjY291bnQLCgAAAGNhbmRpZGF0ZXMQAhQAAgAAAAMAAAB1cmwWAgQAAABoYXNoHiAAAAARAAAAZ3VhcmRpYW5fYWNjb3VudHMQAgsPAAAAZWxpZ2libGVfdm90ZXJzFAACAAAACgAAAHBhcmFtZXRlcnMUAAIAAAAKAAAAc3RhcnRfdGltZQ0IAAAAZW5kX3RpbWUNBAAAAGRhdGEUAAIAAAADAAAAdXJsFgIEAAAAaGFzaB4gAAAAEQAAAGVsZWN0aW9uX21hbmlmZXN0FAACAAAAAwAAAHVybBYCBAAAAGhhc2geIAAAABMAAABlbGVjdGlvbl9wYXJhbWV0ZXJzFAACAAAAAwAAAHVybBYCBAAAAGhhc2geIAAAABQAAABlbGVjdGlvbl9kZXNjcmlwdGlvbhYCDgAAAGVsZWN0aW9uX3N0YXJ0DQwAAABlbGVjdGlvbl9lbmQNEwAAAGRlY3J5cHRpb25fZGVhZGxpbmUNEQAAAGRlbGVnYXRpb25fc3RyaW5nFgI=');
    const field174 = schemaJson.admin_account;
    const accountAddress175 = SDK.AccountAddress.fromSchemaValue(field174);
    const field176 = schemaJson.candidates;
    const list177 = field176.map((item178) => {
    const field179 = item178.url;
    const field180 = item178.hash;
    const named181 = {
    url: field179,
    hash: field180,
    };
    return named181;
    });
    const field182 = schemaJson.guardian_accounts;
    const list183 = field182.map((item184) => {
    const accountAddress185 = SDK.AccountAddress.fromSchemaValue(item184);
    return accountAddress185;
    });
    const field186 = schemaJson.eligible_voters;
    const field187 = field186.parameters;
    const field188 = field187.start_time;
    const timestamp189 = SDK.Timestamp.fromSchemaValue(field188);
    const field190 = field187.end_time;
    const timestamp191 = SDK.Timestamp.fromSchemaValue(field190);
    const named192 = {
    start_time: timestamp189,
    end_time: timestamp191,
    };
    const field193 = field186.data;
    const field194 = field193.url;
    const field195 = field193.hash;
    const named196 = {
    url: field194,
    hash: field195,
    };
    const named197 = {
    parameters: named192,
    data: named196,
    };
    const field198 = schemaJson.election_manifest;
    const field199 = field198.url;
    const field200 = field198.hash;
    const named201 = {
    url: field199,
    hash: field200,
    };
    const field202 = schemaJson.election_parameters;
    const field203 = field202.url;
    const field204 = field202.hash;
    const named205 = {
    url: field203,
    hash: field204,
    };
    const field206 = schemaJson.election_description;
    const field207 = schemaJson.election_start;
    const timestamp208 = SDK.Timestamp.fromSchemaValue(field207);
    const field209 = schemaJson.election_end;
    const timestamp210 = SDK.Timestamp.fromSchemaValue(field209);
    const field211 = schemaJson.decryption_deadline;
    const timestamp212 = SDK.Timestamp.fromSchemaValue(field211);
    const field213 = schemaJson.delegation_string;
    const named214 = {
    admin_account: accountAddress175,
    candidates: list177,
    guardian_accounts: list183,
    eligible_voters: named197,
    election_manifest: named201,
    election_parameters: named205,
    election_description: field206,
    election_start: timestamp208,
    election_end: timestamp210,
    decryption_deadline: timestamp212,
    delegation_string: field213,
    };
    return named214;
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
    let match215: { type: 'None'} | { type: 'Some', content: Array<{
    candidate: {
    url: string,
    hash: SDK.HexString,
    },
    cummulative_votes: number | bigint,
    }> };
    if ('None' in schemaJson) {
       match215 = {
           type: 'None',
       };
    } else if ('Some' in schemaJson) {
       const variant217 = schemaJson.Some;
    const list218 = variant217[0].map((item219) => {
    const field220 = item219.candidate;
    const field221 = field220.url;
    const field222 = field220.hash;
    const named223 = {
    url: field221,
    hash: field222,
    };
    const field224 = item219.cummulative_votes;
    const named225 = {
    candidate: named223,
    cummulative_votes: field224,
    };
    return named225;
    });
       match215 = {
           type: 'Some',
           content: list218,
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match215;
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
    let match226: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match226 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match226 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match226 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match226 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match226 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match226 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match226
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
    let match233: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in schemaJson) {
       match233 = {
           type: 'None',
       };
    } else if ('Some' in schemaJson) {
       const variant235 = schemaJson.Some;
       match233 = {
           type: 'Some',
           content: variant235[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match233;
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
    let match238: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'} | { type: 'GuardianExcluded'};
    if ('ParseParams' in schemaJson) {
       match238 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match238 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match238 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match238 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match238 = {
           type: 'DuplicateEntry',
       };
    } else if ('GuardianExcluded' in schemaJson) {
       match238 = {
           type: 'GuardianExcluded',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match238
}
