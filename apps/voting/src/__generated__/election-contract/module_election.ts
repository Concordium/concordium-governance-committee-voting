// @ts-nocheck
import * as SDK from "@concordium/web-sdk";

/** The reference of the smart contract module supported by the provided client. */
export const moduleReference: SDK.ModuleReference.Type = /*#__PURE__*/ SDK.ModuleReference.fromHexString('b38b59d17279ba5d75d5d37cc1e3ddaa3f1dadb14550602b36debd98d8704b1c');
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
export type ErrorMessageRegisterVotes = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'MalformedConfig'} | { type: 'MalformedElectionResult'} | { type: 'ElectionClosed'} | { type: 'Inconclusive'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'MalformedConfig' : [] } | {'MalformedElectionResult' : [] } | {'ElectionClosed' : [] } | {'Inconclusive' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIPAAAATWFsZm9ybWVkQ29uZmlnAhcAAABNYWxmb3JtZWRFbGVjdGlvblJlc3VsdAIOAAAARWxlY3Rpb25DbG9zZWQCDAAAAEluY29uY2x1c2l2ZQI=');
    let match32: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'MalformedConfig'} | { type: 'MalformedElectionResult'} | { type: 'ElectionClosed'} | { type: 'Inconclusive'};
    if ('ParseParams' in schemaJson) {
       match32 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match32 = {
           type: 'Unauthorized',
       };
    } else if ('MalformedConfig' in schemaJson) {
       match32 = {
           type: 'MalformedConfig',
       };
    } else if ('MalformedElectionResult' in schemaJson) {
       match32 = {
           type: 'MalformedElectionResult',
       };
    } else if ('ElectionClosed' in schemaJson) {
       match32 = {
           type: 'ElectionClosed',
       };
    } else if ('Inconclusive' in schemaJson) {
       match32 = {
           type: 'Inconclusive',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match32
}

/** Parameter type for update transaction for 'postElectionResult' entrypoint of the 'election' contract. */
export type PostElectionResultParameter = Array<number | bigint>;

/**
 * Construct Parameter for update transactions for 'postElectionResult' entrypoint of the 'election' contract.
 * @param {PostElectionResultParameter} parameter The structured parameter to construct from.
 * @returns {SDK.Parameter.Type} The smart contract parameter.
 */
export function createPostElectionResultParameter(parameter: PostElectionResultParameter): SDK.Parameter.Type {
    const list39 = parameter.map((item40) => {
    const number41 = BigInt(item40);
    return number41;
    });
    const out = SDK.Parameter.fromBase64SchemaType('EAIF', list39);
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
export type ErrorMessagePostElectionResult = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'MalformedConfig'} | { type: 'MalformedElectionResult'} | { type: 'ElectionClosed'} | { type: 'Inconclusive'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'MalformedConfig' : [] } | {'MalformedElectionResult' : [] } | {'ElectionClosed' : [] } | {'Inconclusive' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIPAAAATWFsZm9ybWVkQ29uZmlnAhcAAABNYWxmb3JtZWRFbGVjdGlvblJlc3VsdAIOAAAARWxlY3Rpb25DbG9zZWQCDAAAAEluY29uY2x1c2l2ZQI=');
    let match42: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'MalformedConfig'} | { type: 'MalformedElectionResult'} | { type: 'ElectionClosed'} | { type: 'Inconclusive'};
    if ('ParseParams' in schemaJson) {
       match42 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match42 = {
           type: 'Unauthorized',
       };
    } else if ('MalformedConfig' in schemaJson) {
       match42 = {
           type: 'MalformedConfig',
       };
    } else if ('MalformedElectionResult' in schemaJson) {
       match42 = {
           type: 'MalformedElectionResult',
       };
    } else if ('ElectionClosed' in schemaJson) {
       match42 = {
           type: 'ElectionClosed',
       };
    } else if ('Inconclusive' in schemaJson) {
       match42 = {
           type: 'Inconclusive',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match42
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
    guardians: Array<SDK.AccountAddress.Type>,
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
    guardians: Array<SDK.AccountAddress.SchemaValue>,
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
    }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FAAJAAAADQAAAGFkbWluX2FjY291bnQLCgAAAGNhbmRpZGF0ZXMQAhQAAgAAAAMAAAB1cmwWAgQAAABoYXNoHiAAAAAJAAAAZ3VhcmRpYW5zEAILDwAAAGVsaWdpYmxlX3ZvdGVycxQAAgAAAAMAAAB1cmwWAgQAAABoYXNoHiAAAAARAAAAZWxlY3Rpb25fbWFuaWZlc3QUAAIAAAADAAAAdXJsFgIEAAAAaGFzaB4gAAAAEwAAAGVsZWN0aW9uX3BhcmFtZXRlcnMUAAIAAAADAAAAdXJsFgIEAAAAaGFzaB4gAAAAFAAAAGVsZWN0aW9uX2Rlc2NyaXB0aW9uFgIOAAAAZWxlY3Rpb25fc3RhcnQNDAAAAGVsZWN0aW9uX2VuZA0=');
    const field49 = schemaJson.admin_account;
    const accountAddress50 = SDK.AccountAddress.fromSchemaValue(field49);
    const field51 = schemaJson.candidates;
    const list52 = field51.map((item53) => {
    const field54 = item53.url;
    const field55 = item53.hash;
    const named56 = {
    url: field54,
    hash: field55,
    };
    return named56;
    });
    const field57 = schemaJson.guardians;
    const list58 = field57.map((item59) => {
    const accountAddress60 = SDK.AccountAddress.fromSchemaValue(item59);
    return accountAddress60;
    });
    const field61 = schemaJson.eligible_voters;
    const field62 = field61.url;
    const field63 = field61.hash;
    const named64 = {
    url: field62,
    hash: field63,
    };
    const field65 = schemaJson.election_manifest;
    const field66 = field65.url;
    const field67 = field65.hash;
    const named68 = {
    url: field66,
    hash: field67,
    };
    const field69 = schemaJson.election_parameters;
    const field70 = field69.url;
    const field71 = field69.hash;
    const named72 = {
    url: field70,
    hash: field71,
    };
    const field73 = schemaJson.election_description;
    const field74 = schemaJson.election_start;
    const timestamp75 = SDK.Timestamp.fromSchemaValue(field74);
    const field76 = schemaJson.election_end;
    const timestamp77 = SDK.Timestamp.fromSchemaValue(field76);
    const named78 = {
    admin_account: accountAddress50,
    candidates: list52,
    guardians: list58,
    eligible_voters: named64,
    election_manifest: named68,
    election_parameters: named72,
    election_description: field73,
    election_start: timestamp75,
    election_end: timestamp77,
    };
    return named78;
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
    let match79: { type: 'None'} | { type: 'Some', content: Array<{
    candidate: {
    url: string,
    hash: SDK.HexString,
    },
    cummulative_votes: number | bigint,
    }> };
    if ('None' in schemaJson) {
       match79 = {
           type: 'None',
       };
    } else if ('Some' in schemaJson) {
       const variant81 = schemaJson.Some;
    const list82 = variant81[0].map((item83) => {
    const field84 = item83.candidate;
    const field85 = field84.url;
    const field86 = field84.hash;
    const named87 = {
    url: field85,
    hash: field86,
    };
    const field88 = item83.cummulative_votes;
    const named89 = {
    candidate: named87,
    cummulative_votes: field88,
    };
    return named89;
    });
       match79 = {
           type: 'Some',
           content: list82,
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match79;
}

/** Error message for dry-running update transaction for 'viewElectionResult' entrypoint of the 'election' contract. */
export type ErrorMessageViewElectionResult = { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'MalformedConfig'} | { type: 'MalformedElectionResult'} | { type: 'ElectionClosed'} | { type: 'Inconclusive'};

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
    const schemaJson = <{'ParseParams' : [] } | {'Unauthorized' : [] } | {'MalformedConfig' : [] } | {'MalformedElectionResult' : [] } | {'ElectionClosed' : [] } | {'Inconclusive' : [] }>SDK.ReturnValue.parseWithSchemaTypeBase64(invokeResult.returnValue, 'FQYAAAALAAAAUGFyc2VQYXJhbXMCDAAAAFVuYXV0aG9yaXplZAIPAAAATWFsZm9ybWVkQ29uZmlnAhcAAABNYWxmb3JtZWRFbGVjdGlvblJlc3VsdAIOAAAARWxlY3Rpb25DbG9zZWQCDAAAAEluY29uY2x1c2l2ZQI=');
    let match90: { type: 'ParseParams'} | { type: 'Unauthorized'} | { type: 'MalformedConfig'} | { type: 'MalformedElectionResult'} | { type: 'ElectionClosed'} | { type: 'Inconclusive'};
    if ('ParseParams' in schemaJson) {
       match90 = {
           type: 'ParseParams',
       };
    } else if ('Unauthorized' in schemaJson) {
       match90 = {
           type: 'Unauthorized',
       };
    } else if ('MalformedConfig' in schemaJson) {
       match90 = {
           type: 'MalformedConfig',
       };
    } else if ('MalformedElectionResult' in schemaJson) {
       match90 = {
           type: 'MalformedElectionResult',
       };
    } else if ('ElectionClosed' in schemaJson) {
       match90 = {
           type: 'ElectionClosed',
       };
    } else if ('Inconclusive' in schemaJson) {
       match90 = {
           type: 'Inconclusive',
       };
    }
     else {
       throw new Error("Unexpected enum variant");
    }
    return match90
}
