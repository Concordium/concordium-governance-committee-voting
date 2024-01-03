// @ts-nocheck
import * as SDK from "@concordium/web-sdk";

/** The reference of the smart contract module supported by the provided client. */
export const moduleReference: SDK.ModuleReference.Type = /*#__PURE__*/ SDK.ModuleReference.fromHexString('e8fc258ccdd334dcb58a629afe947f4aa9cb18eab45e9d7ae0ade8818746eeec');
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
    let match32: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match32 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match32 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match32 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match32 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match32 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match32
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
    let match40: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match40 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match40 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match40 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match40 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match40 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match40
}

/** Parameter type for update transaction for 'registerGuardianStatus' entrypoint of the 'election' contract. */
export type RegisterGuardianStatusParameter = { type: 'VerificationFailed', content: string } | { type: 'VerificationSuccessful'};

/**
 * Construct Parameter for update transactions for 'registerGuardianStatus' entrypoint of the 'election' contract.
 * @param {RegisterGuardianStatusParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createRegisterGuardianStatusParameter(parameter: RegisterGuardianStatusParameter): SDK.Parameter.Type {
    let match46: {'VerificationFailed' : [string] } | {'VerificationSuccessful' : [] };
    switch (parameter.type) {
        case 'VerificationFailed':
            match46 = { VerificationFailed: [parameter.content], };
        break;
        case 'VerificationSuccessful':
            match46 = { VerificationSuccessful: [], };
        break;
    }
    const out = SDK.Parameter.fromBase64SchemaType('FQIAAAASAAAAVmVyaWZpY2F0aW9uRmFpbGVkAQEAAAAWAhYAAABWZXJpZmljYXRpb25TdWNjZXNzZnVsAg==', match46);
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
    let match47: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match47 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match47 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match47 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match47 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match47 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match47
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
    public_key: { type: 'None'} | { type: 'Some', content: Array<number> },
    encrypted_share: { type: 'None'} | { type: 'Some', content: Array<number> },
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
    public_key: {'None' : [] } | {'Some' : [Array<number>] },
    encrypted_share: {'None' : [] } | {'Some' : [Array<number>] },
    status: {'None' : [] } | {'Some' : [{'VerificationFailed' : [string] } | {'VerificationSuccessful' : [] }] },
    }]>>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'EAIPCxQAAwAAAAoAAABwdWJsaWNfa2V5FQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAEAICDwAAAGVuY3J5cHRlZF9zaGFyZRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABACAgYAAABzdGF0dXMVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAAVAgAAABIAAABWZXJpZmljYXRpb25GYWlsZWQBAQAAABYCFgAAAFZlcmlmaWNhdGlvblN1Y2Nlc3NmdWwC');
    const list53 = schemaJson.map((item54) => {
    const accountAddress56 = SDK.AccountAddress.fromSchemaValue(item54[0]);
    const field57 = item54[1].public_key;
    let match58: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field57) {
       match58 = {
           type: 'None',
       };
    } else if ('Some' in field57) {
       const variant60 = field57.Some;
       match58 = {
           type: 'Some',
           content: variant60[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field63 = item54[1].encrypted_share;
    let match64: { type: 'None'} | { type: 'Some', content: Array<number> };
    if ('None' in field63) {
       match64 = {
           type: 'None',
       };
    } else if ('Some' in field63) {
       const variant66 = field63.Some;
       match64 = {
           type: 'Some',
           content: variant66[0],
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const field69 = item54[1].status;
    let match70: { type: 'None'} | { type: 'Some', content: { type: 'VerificationFailed', content: string } | { type: 'VerificationSuccessful'} };
    if ('None' in field69) {
       match70 = {
           type: 'None',
       };
    } else if ('Some' in field69) {
       const variant72 = field69.Some;
    let match73: { type: 'VerificationFailed', content: string } | { type: 'VerificationSuccessful'};
    if ('VerificationFailed' in variant72[0]) {
       const variant74 = variant72[0].VerificationFailed;
       match73 = {
           type: 'VerificationFailed',
           content: variant74[0],
       };
    } else if ('VerificationSuccessful' in variant72[0]) {
       match73 = {
           type: 'VerificationSuccessful',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
       match70 = {
           type: 'Some',
           content: match73,
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    const named76 = {
    public_key: match58,
    encrypted_share: match64,
    status: match70,
    };
    const pair55: [SDK.AccountAddress.Type, {
    public_key: { type: 'None'} | { type: 'Some', content: Array<number> },
    encrypted_share: { type: 'None'} | { type: 'Some', content: Array<number> },
    status: { type: 'None'} | { type: 'Some', content: { type: 'VerificationFailed', content: string } | { type: 'VerificationSuccessful'} },
    }] = [accountAddress56, named76];
    return pair55;
    });
    return list53;
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
    let match79: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match79 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match79 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match79 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match79 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match79 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match79
}

/** Parameter type for update transaction for 'postElectionResult' entrypoint of the 'election' contract. */
export type PostElectionResultParameter = Array<number | bigint>;

/**
 * Construct Parameter for update transactions for 'postElectionResult' entrypoint of the 'election' contract.
 * @param {PostElectionResultParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createPostElectionResultParameter(parameter: PostElectionResultParameter): SDK.Parameter.Type {
    const list85 = parameter.map((item86) => {
    const number87 = BigInt(item86);
    return number87;
    });
    const out = SDK.Parameter.fromBase64SchemaType('EAIF', list85);
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
    let match88: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
    if ('ParseParams' in schemaJson) {
       match88 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match88 = {
           type: 'Unauthorized',
       };
    } else if ('Malformed' in schemaJson) {
       match88 = {
           type: 'Malformed',
       };
    } else if ('IncorrectElectionPhase' in schemaJson) {
       match88 = {
           type: 'IncorrectElectionPhase',
       };
    } else if ('DuplicateEntry' in schemaJson) {
       match88 = {
           type: 'DuplicateEntry',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match88
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
    }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FAAJAAAADQAAAGFkbWluX2FjY291bnQLCgAAAGNhbmRpZGF0ZXMQAhQAAgAAAAMAAAB1cmwWAgQAAABoYXNoHiAAAAANAAAAZ3VhcmRpYW5fa2V5cxACEAICDwAAAGVsaWdpYmxlX3ZvdGVycxQAAgAAAAMAAAB1cmwWAgQAAABoYXNoHiAAAAARAAAAZWxlY3Rpb25fbWFuaWZlc3QUAAIAAAADAAAAdXJsFgIEAAAAaGFzaB4gAAAAEwAAAGVsZWN0aW9uX3BhcmFtZXRlcnMUAAIAAAADAAAAdXJsFgIEAAAAaGFzaB4gAAAAFAAAAGVsZWN0aW9uX2Rlc2NyaXB0aW9uFgIOAAAAZWxlY3Rpb25fc3RhcnQNDAAAAGVsZWN0aW9uX2VuZA0=');
    const field94 = schemaJson.admin_account;
    const accountAddress95 = SDK.AccountAddress.fromSchemaValue(field94);
    const field96 = schemaJson.candidates;
    const list97 = field96.map((item98) => {
    const field99 = item98.url;
    const field100 = item98.hash;
    const named101 = {
    url: field99,
    hash: field100,
    };
    return named101;
    });
    const field102 = schemaJson.guardian_keys;
    const field107 = schemaJson.eligible_voters;
    const field108 = field107.url;
    const field109 = field107.hash;
    const named110 = {
    url: field108,
    hash: field109,
    };
    const field111 = schemaJson.election_manifest;
    const field112 = field111.url;
    const field113 = field111.hash;
    const named114 = {
    url: field112,
    hash: field113,
    };
    const field115 = schemaJson.election_parameters;
    const field116 = field115.url;
    const field117 = field115.hash;
    const named118 = {
    url: field116,
    hash: field117,
    };
    const field119 = schemaJson.election_description;
    const field120 = schemaJson.election_start;
    const timestamp121 = SDK.Timestamp.fromSchemaValue(field120);
    const field122 = schemaJson.election_end;
    const timestamp123 = SDK.Timestamp.fromSchemaValue(field122);
    const named124 = {
    admin_account: accountAddress95,
    candidates: list97,
    guardian_keys: field102,
    eligible_voters: named110,
    election_manifest: named114,
    election_parameters: named118,
    election_description: field119,
    election_start: timestamp121,
    election_end: timestamp123,
    };
    return named124;
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
    let match125: { type: 'None'} | { type: 'Some', content: Array<{
    candidate: {
    url: string,
    hash: SDK.HexString,
    },
    cummulative_votes: number | bigint,
    }> };
    if ('None' in schemaJson) {
       match125 = {
           type: 'None',
       };
    } else if ('Some' in schemaJson) {
       const variant127 = schemaJson.Some;
    const list128 = variant127[0].map((item129) => {
    const field130 = item129.candidate;
    const field131 = field130.url;
    const field132 = field130.hash;
    const named133 = {
    url: field131,
    hash: field132,
    };
    const field134 = item129.cummulative_votes;
    const named135 = {
    candidate: named133,
    cummulative_votes: field134,
    };
    return named135;
    });
       match125 = {
           type: 'Some',
           content: list128,
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match125;
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
    let match136: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'Malformed'} | { type: 'IncorrectElectionPhase'} | { type: 'DuplicateEntry'};
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
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match136
}
