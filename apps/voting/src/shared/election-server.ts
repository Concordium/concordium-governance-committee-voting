import { AccountAddress, Base58String, HexString, TransactionHash } from '@concordium/web-sdk';
import { BACKEND_API } from './constants';

/**
 * A candidate vote as stored in the backend database
 */
export interface DatabaseCandidateVote {
    /** Whether the candidate was voted for */
    hasVote: boolean;
    /** The index of the candidate */
    candidateIndex: number;
}
/**
 * A ballot submission as stored in the backend database.
 */
interface DatabaseBallotSubmissionSerializable {
    /** The submitting account address */
    account: Base58String;
    /** The transaction hash corresponding to the submission */
    transactionHash: HexString;
    /** The slot time of the block the submission is included in */
    blockTime: string;
    /** Whether the ballot could be verified */
    verified: boolean;
    /** The contents of the ballot */
    ballot: DatabaseCandidateVote[];
}
/**
 * A ballot submission as stored in the backend database. Deserialized into the representative types where possible.
 */
export interface DatabaseBallotSubmission {
    /** The submitting account address */
    account: AccountAddress.Type;
    /** The transaction hash corresponding to the submission */
    transactionHash: TransactionHash.Type;
    /** The slot time of the block the submission is included in */
    blockTime: Date;
    /** Whether the ballot could be verified */
    verified: boolean;
    /** The contents of the ballot */
    ballot: DatabaseCandidateVote[];
}

/**
 * Converts {@linkcode DatabaseBallotSubmissionSerializable} to {@linkcode DatabaseBallotSubmission}
 */
function reviveBallotSubmission(value: DatabaseBallotSubmissionSerializable): DatabaseBallotSubmission {
    const account = AccountAddress.fromBase58(value.account);
    const transactionHash = TransactionHash.fromHexString(value.transactionHash);
    const blockTime = new Date(value.blockTime);
    return {
        ...value,
        account,
        transactionHash,
        blockTime,
    };
}

/**
 * Gets the ballot submission corresponding to a transaction type.
 *
 * @param transaction - The transaction hash to query ballot submission for
 *
 * @returns A promise which resolves with {@linkcode DatabaseBallotSubmission} or null if none could be found.
 * @throws On http errors.
 */
export async function getSubmission(transaction: TransactionHash.Type): Promise<DatabaseBallotSubmission | null> {
    const transactionHex = TransactionHash.toHexString(transaction);
    const url = `${BACKEND_API}/api/submission-status/${transactionHex}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(
            `Error happened while trying to fetch ballot submission by transaction ${transactionHex} - ${res.status} (${res.statusText})`,
        );
    }

    const json = (await res.json()) as DatabaseBallotSubmissionSerializable | null;
    return json !== undefined && json !== null ? reviveBallotSubmission(json) : null;
}

/**
 * Gets the ballot submissions submitted by an account
 *
 * @param account - The account address to query ballot submissions for
 *
 * @returns A promise which resolves with a list of {@linkcode DatabaseBallotSubmission}.
 * @throws On http errors.
 */
export async function getAccountSubmissions(accountAddress: AccountAddress.Type): Promise<DatabaseBallotSubmission[]> {
    const acccoutBase58 = AccountAddress.toBase58(accountAddress);
    const url = `${BACKEND_API}/api/submissions/${acccoutBase58}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(
            `Error happened while trying to fetch ballot submissions for account ${acccoutBase58} - ${res.status} (${res.statusText})`,
        );
    }

    const json = (await res.json()) as DatabaseBallotSubmissionSerializable[];
    return json.map(reviveBallotSubmission);
}
