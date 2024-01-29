// @ts-nocheck
import * as SDK from "@concordium/web-sdk";

/** The reference of the smart contract module supported by the provided client. */
export const moduleReference: SDK.ModuleReference.Type = /*#__PURE__*/ SDK.ModuleReference.fromHexString('be0a707dde28fc97e8d206d784fe1d213c46704815e98de5edfc2c05f86d8108');
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
export type ErrorMessageRegisterGuardianPublicKey = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match33: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match33 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match33 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match33 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match33 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match33 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match33
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
export type ErrorMessageRegisterGuardianEncryptedShare = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match41: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match41 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match41 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match41 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match41 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match41 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match41
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
export type ErrorMessagePostDecryptionShare = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match49: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match49 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match49 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match49 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match49 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match49 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match49
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
export type ErrorMessagePostDecryptionProofResponseShare = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match57: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match57 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match57 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match57 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match57 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match57 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match57
}

/** Parameter type for update transaction for 'registerGuardianStatus' entrypoint of the 'election' contract. */
export type RegisterGuardianStatusParameter = { type: 'VerificationFailed', content: string } | { type: 'VerificationSuccessful'};

/**
 * Construct Parameter for update transactions for 'registerGuardianStatus' entrypoint of the 'election' contract.
 * @param {RegisterGuardianStatusParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createRegisterGuardianStatusParameter(parameter: RegisterGuardianStatusParameter): SDK.Parameter.Type {
    let match63: {'VerificationFailed' : [string] } | {'VerificationSuccessful' : [] };
    switch (parameter.type) {
        case 'VerificationFailed':
            match63 = { VerificationFailed: [parameter.content], };
        break;
        case 'VerificationSuccessful':
            match63 = { VerificationSuccessful: [], };
        break;
    }
    const out = SDK.Parameter.fromBase64SchemaType('FQIAAAASAAAAVmVyaWZpY2F0aW9uRmFpbGVkAQEAAAAWAhYAAABWZXJpZmljYXRpb25TdWNjZXNzZnVsAg==', match63);
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
export type ErrorMessageRegisterGuardianStatus = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match64: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match64 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match64 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match64 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match64 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match64 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match64
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
    status: { type: 'None'} | { type: 'Some', content: { type: 'VerificationFailed', content: string } | { type: 'VerificationSuccessful'} },
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
    status: {'None' : [] } | {'Some' : [{'VerificationFailed' : [string] } | {'VerificationSuccessful' : [] }] },
    }]>>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'EAIPCxQABgAAAAUAAABpbmRleAQKAAAAcHVibGljX2tleRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABACAg8AAABlbmNyeXB0ZWRfc2hhcmUVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAAQAgIQAAAAZGVjcnlwdGlvbl9zaGFyZRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABACAhYAAABkZWNyeXB0aW9uX3NoYXJlX3Byb29mFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAEAICBgAAAHN0YXR1cxUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABUCAAAAEgAAAFZlcmlmaWNhdGlvbkZhaWxlZAEBAAAAFgIWAAAAVmVyaWZpY2F0aW9uU3VjY2Vzc2Z1bAI=');
    const list70 = schemaJson.map((item71) => {
    const accountAddress73 = SDK.AccountAddress.fromSchemaValue(item71[0]);
    const field74 = item71[1].index;
    const field75 = item71[1].public_key;
    let match76: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field75) {
       match76 = {
           type: 'None',
       };
    } else if ('Some' in field75) {
       const variant78 = field75.Some;
       match76 = {
           type: 'Some',
           content: variant78[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field81 = item71[1].encrypted_share;
    let match82: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field81) {
       match82 = {
           type: 'None',
       };
    } else if ('Some' in field81) {
       const variant84 = field81.Some;
       match82 = {
           type: 'Some',
           content: variant84[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field87 = item71[1].decryption_share;
    let match88: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field87) {
       match88 = {
           type: 'None',
       };
    } else if ('Some' in field87) {
       const variant90 = field87.Some;
       match88 = {
           type: 'Some',
           content: variant90[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field93 = item71[1].decryption_share_proof;
    let match94: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field93) {
       match94 = {
           type: 'None',
       };
    } else if ('Some' in field93) {
       const variant96 = field93.Some;
       match94 = {
           type: 'Some',
           content: variant96[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field99 = item71[1].status;
    let match100: { type: 'None'} | { type: 'Some', content: { type: 'VerificationFailed', content: string } | { type: 'VerificationSuccessful'} };
    if ('None' in field99) {
       match100 = {
           type: 'None',
       };
    } else if ('Some' in field99) {
       const variant102 = field99.Some;
    let match103: { type: 'VerificationFailed', content: string } | { type: 'VerificationSuccessful'};
    if ('VerificationFailed' in variant102[0]) {
       const variant104 = variant102[0].VerificationFailed;
       match103 = {
           type: 'VerificationFailed',
           content: variant104[0],
       };
    } else if ('VerificationSuccessful' in variant102[0]) {
       match103 = {
           type: 'VerificationSuccessful',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
       match100 = {
           type: 'Some',
           content: match103,
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const named106 = {
    index: field74,
    public_key: match76,
    encrypted_share: match82,
    decryption_share: match88,
    decryption_share_proof: match94,
    status: match100,
    };
    const pair72: [SDK.AccountAddress.Type, {
    index: number,
    public_key: { type: 'None'} | { type: 'Some', content: Array<number> },
    encrypted_share: { type: 'None'} | { type: 'Some', content: Array<number> },
    decryption_share: { type: 'None'} | { type: 'Some', content: Array<number> },
    decryption_share_proof: { type: 'None'} | { type: 'Some', content: Array<number> },
    status: { type: 'None'} | { type: 'Some', content: { type: 'VerificationFailed', content: string } | { type: 'VerificationSuccessful'} },
    }] = [accountAddress73, named106];
    return pair72;
    });
    return list70;
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
export type ErrorMessageRegisterVotes = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match109: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match109 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match109 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match109 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match109 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match109 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match109
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
export type ErrorMessagePostEncryptedTally = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match117: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match117 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match117 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match117 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match117 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match117 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match117
}

/** Parameter type for update transaction for 'postElectionResult' entrypoint of the 'election' contract. */
export type PostElectionResultParameter = Array<number | bigint>;

/**
 * Construct Parameter for update transactions for 'postElectionResult' entrypoint of the 'election' contract.
 * @param {PostElectionResultParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createPostElectionResultParameter(parameter: PostElectionResultParameter): SDK.Parameter.Type {
    const list123 = parameter.map((item124) => {
    const number125 = BigInt(item124);
    return number125;
    });
    const out = SDK.Parameter.fromBase64SchemaType('EAIF', list123);
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
export type ErrorMessagePostElectionResult = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match126: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match126 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match126 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match126 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match126 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match126 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match126
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
    delegation_string: string,
    }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FAAKAAAADQAAAGFkbWluX2FjY291bnQLCgAAAGNhbmRpZGF0ZXMQAhQAAgAAAAMAAAB1cmwWAgQAAABoYXNoHiAAAAANAAAAZ3VhcmRpYW5fa2V5cxACEAICDwAAAGVsaWdpYmxlX3ZvdGVycxQAAgAAAAMAAAB1cmwWAgQAAABoYXNoHiAAAAARAAAAZWxlY3Rpb25fbWFuaWZlc3QUAAIAAAADAAAAdXJsFgIEAAAAaGFzaB4gAAAAEwAAAGVsZWN0aW9uX3BhcmFtZXRlcnMUAAIAAAADAAAAdXJsFgIEAAAAaGFzaB4gAAAAFAAAAGVsZWN0aW9uX2Rlc2NyaXB0aW9uFgIOAAAAZWxlY3Rpb25fc3RhcnQNDAAAAGVsZWN0aW9uX2VuZA0RAAAAZGVsZWdhdGlvbl9zdHJpbmcWAg==');
    const field132 = schemaJson.admin_account;
    const accountAddress133 = SDK.AccountAddress.fromSchemaValue(field132);
    const field134 = schemaJson.candidates;
    const list135 = field134.map((item136) => {
    const field137 = item136.url;
    const field138 = item136.hash;
    const named139 = {
    url: field137,
    hash: field138,
    };
    return named139;
    });
    const field140 = schemaJson.guardian_keys;
    const field145 = schemaJson.eligible_voters;
    const field146 = field145.url;
    const field147 = field145.hash;
    const named148 = {
    url: field146,
    hash: field147,
    };
    const field149 = schemaJson.election_manifest;
    const field150 = field149.url;
    const field151 = field149.hash;
    const named152 = {
    url: field150,
    hash: field151,
    };
    const field153 = schemaJson.election_parameters;
    const field154 = field153.url;
    const field155 = field153.hash;
    const named156 = {
    url: field154,
    hash: field155,
    };
    const field157 = schemaJson.election_description;
    const field158 = schemaJson.election_start;
    const timestamp159 = SDK.Timestamp.fromSchemaValue(field158);
    const field160 = schemaJson.election_end;
    const timestamp161 = SDK.Timestamp.fromSchemaValue(field160);
    const field162 = schemaJson.delegation_string;
    const named163 = {
    admin_account: accountAddress133,
    candidates: list135,
    guardian_keys: field140,
    eligible_voters: named148,
    election_manifest: named152,
    election_parameters: named156,
    election_description: field157,
    election_start: timestamp159,
    election_end: timestamp161,
    delegation_string: field162,
    };
    return named163;
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
    let match164: { type: 'None'} | { type: 'Some', content: Array<{
    candidate: {
    url: string,
    hash: SDK.HexString,
    },
    cummulative_votes: number | bigint,
    }> };
    if ('None' in schemaJson) {
       match164 = {
           type: 'None',
       };
    } else if ('Some' in schemaJson) {
       const variant166 = schemaJson.Some;
    const list167 = variant166[0].map((item168) => {
    const field169 = item168.candidate;
    const field170 = field169.url;
    const field171 = field169.hash;
    const named172 = {
    url: field170,
    hash: field171,
    };
    const field173 = item168.cummulative_votes;
    const named174 = {
    candidate: named172,
    cummulative_votes: field173,
    };
    return named174;
    });
       match164 = {
           type: 'Some',
           content: list167,
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match164;
}

/** Error message for dry-running update transaction for 'viewElectionResult' entrypoint of the 'election' contract. */
export type ErrorMessageViewElectionResult = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match175: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match175 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match175 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match175 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match175 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match175 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match175
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
    let match181: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in schemaJson) {
       match181 = {
           type: 'None',
       };
    } else if ('Some' in schemaJson) {
       const variant183 = schemaJson.Some;
       match181 = {
           type: 'Some',
           content: variant183[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match181;
}

/** Error message for dry-running update transaction for 'viewEncryptedTally' entrypoint of the 'election' contract. */
export type ErrorMessageViewEncryptedTally = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'Malformed' : [] } | {'IncorrectElectionPhase' : [] } | {'DuplicateEntry' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQUAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIJAAAATWFsZm9ybWVkAhYAAABJbmNvcnJlY3RFbGVjdGlvblBoYXNlAg4AAABEdXBsaWNhdGVFbnRyeQI=');
    let match186: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match186 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match186 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match186 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match186 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match186 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match186
}
