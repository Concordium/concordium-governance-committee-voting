import { AccountAddress, Base58String, HexString, TransactionHash } from '@concordium/web-sdk';
import { BACKEND_API } from './constants';

export interface DatabaseCandidateVote {
    hasVote: boolean;
    candidateIndex: number;
}
export interface DatabaseBallotSubmissionJson {
    account: Base58String;
    transactionHash: HexString;
    timestamp: string;
    verified: boolean;
    ballot: DatabaseCandidateVote[];
}
export interface DatabaseBallotSubmission {
    account: AccountAddress.Type;
    transactionHash: TransactionHash.Type;
    timestamp: Date;
    verified: boolean;
    ballot: DatabaseCandidateVote[];
}

function reviveBallotSubmission(value: DatabaseBallotSubmissionJson): DatabaseBallotSubmission {
    const account = AccountAddress.fromBase58(value.account);
    const transactionHash = TransactionHash.fromHexString(value.transactionHash);
    const timestamp = new Date(value.timestamp);
    return {
        ...value,
        account,
        transactionHash,
        timestamp,
    };
}

export async function getSubmission(transaction: TransactionHash.Type): Promise<DatabaseBallotSubmission | null> {
    const transactionHex = TransactionHash.toHexString(transaction);
    const url = `${BACKEND_API}/submission-status/${transactionHex}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(
            `Error happened while trying to fetch ballot submission by transaction ${transactionHex} - ${res.status} (${res.statusText})`,
        );
    }

    const json = await res.json() as DatabaseBallotSubmissionJson | null ;
    return json !== undefined && json !== null ? reviveBallotSubmission(json) : null;
}

export async function getAccountSubmissions(accountAddress: AccountAddress.Type): Promise<DatabaseBallotSubmission[]> {
    const acccoutBase58 = AccountAddress.toBase58(accountAddress);
    const url = `${BACKEND_API}/submissions/${acccoutBase58}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(
            `Error happened while trying to fetch ballot submissions for account ${acccoutBase58} - ${res.status} (${res.statusText})`,
        );
    }

    const json = await res.json() as DatabaseBallotSubmissionJson[];
    return json.map(reviveBallotSubmission);
}
