import { atom } from 'jotai';
import { atomFamily, atomWithReset, atomWithStorage } from 'jotai/utils';
import {
    AccountAddress,
    ConcordiumGRPCClient,
    Timestamp,
    TransactionHash,
    TransactionKindString,
    TransactionSummaryType,
} from '@concordium/web-sdk';
import { Buffer } from 'buffer/';
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport';
import { BrowserWalletConnector, WalletConnection } from '@concordium/wallet-connectors';
import { atomEffect } from 'jotai-effect';

import { ChecksumUrl, ElectionContract, getElectionConfig } from './election-contract';
import { expectValue, isDefined } from './util';
import { NETWORK } from './constants';

/**
 * Representation of an election candidate.
 */
interface CandidateDetails {
    /** The name of the candidate */
    name: string;
    /** An image chosen to represent the candidate */
    imageUrl: string;
    /** A URL pointing to a document/webpage describing the candidate */
    descriptionUrl: string;
}

function verifyCandidateDetails(details: unknown): details is CandidateDetails {
    return (
        typeof details === 'object' &&
        details !== null &&
        'name' in details &&
        typeof details.name === 'string' &&
        'imageUrl' in details &&
        typeof details.imageUrl === 'string' &&
        'descriptionUrl' in details &&
        typeof details.descriptionUrl === 'string'
    );
}

/**
 * Representation of an election candidate with associated registration index.
 */
export interface IndexedCandidateDetails extends CandidateDetails {
    /** The index the candidate is registered at in the election contract */
    index: number;
}

/**
 * Representation of the election configration.
 */
export interface ElectionConfig
    extends Omit<ElectionContract.ReturnValueViewConfig, 'candidates' | 'election_start' | 'election_end'> {
    /** The election candidates */
    candidates: IndexedCandidateDetails[];
    start: Date;
    end: Date;
}

/**
 * Gets candidate data at url.
 * @param url - The url and checksum to fetch data from
 * @param index - The index of the candidate in the election configuration
 *
 * @returns A promise which resolves to either
 * - {@linkcode IndexedCandidateDetails} (success)
 * - `undefined` (failure), if
 *   - hash given with url does not match the hash of the data fetched
 *   - fetched data does not conform to expected format
 *   - An error happens while trying to fetch the data
 */
async function getCandidate({ url, hash }: ChecksumUrl, index: number): Promise<IndexedCandidateDetails | undefined> {
    try {
        const response = await fetch(url);
        const bData = Buffer.from(await response.arrayBuffer());

        const checksum = await window.crypto.subtle
            .digest('SHA-256', bData)
            .then((b) => Buffer.from(b).toString('hex'));
        if (checksum !== hash) {
            return undefined;
        }

        const data: unknown = JSON.parse(bData.toString('utf8'));
        if (!verifyCandidateDetails(data)) {
            return undefined;
        }

        return { index, ...data };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

const electionConfigBaseAtom = atom<ElectionConfig | undefined>(undefined);

let electionConfigInitialized = false;
electionConfigBaseAtom.onMount = (setAtom) => {
    if (electionConfigInitialized) {
        return;
    }

    electionConfigInitialized = true;
    void getElectionConfig().then(async (config) => {
        if (config === undefined) {
            return undefined;
        }

        const candiatePromises = config.candidates.map(getCandidate);
        const candidates = (await Promise.all(candiatePromises)).filter(isDefined);
        const mappedConfig: ElectionConfig = {
            ...config,
            start: Timestamp.toDate(config.election_start),
            end: Timestamp.toDate(config.election_end),
            candidates,
        };
        setAtom(mappedConfig);
    });
};

/**
 * Holds the configuration of the election contract. A reference to this should always be kept in the application root
 * to avoid having to fetch the configuration more than once.
 */
export const electionConfigAtom = atom((get) => get(electionConfigBaseAtom));

/**
 * Exposes a function for opening the wallet connection interface (if available).
 */
export const selectConnectionAtom = atomWithReset<(() => void) | undefined>(undefined);

/**
 * Representation of a connection to a wallet.
 */
export interface Wallet {
    /** The currently active account (if any) */
    account: AccountAddress.Type | undefined;
    /** The currently active chain (if any) */
    chain: string | undefined;
    /** The wallet API of the active connection */
    connection: WalletConnection;
}

/**
 * Holds the currently active {@linkcode Wallet} (if any).
 */
export const activeWalletAtom = atom<Wallet | undefined>(undefined);

/**
 * Represents the different status' a ballot submission can have.
 */
export const enum BallotSubmissionStatus {
    /** Committed to the node */
    Committed,
    /** Rejected by the node */
    Rejected,
    /** Approved by the node */
    Approved,
    /** Included in the election tally */
    Included,
    /** Excluded from the election tally (could not verify the ballot submission) */
    Excluded,
}

interface StoredBallotSubmission {
    transaction: TransactionHash.Serializable;
    status: BallotSubmissionStatus;
}

/**
 * The type used to represent ballot submissions.
 */
export class BallotSubmission {
    constructor(
        public readonly transaction: TransactionHash.Type,
        public readonly status: BallotSubmissionStatus,
    ) { }

    /** Construct ballot submission from {@linkcode TransactionHash.Type} with "Committed" status */
    public static fromTransaction(transaction: TransactionHash.Type) {
        return new BallotSubmission(transaction, BallotSubmissionStatus.Committed);
    }

    /** Construct ballot submission from {@linkcode StoredBallotSubmission} */
    public static fromSerializable(value: StoredBallotSubmission) {
        return new BallotSubmission(TransactionHash.fromHexString(value.transaction), value.status);
    }

    /** Represent ballot submission as {@linkcode StoredBallotSubmission} */
    public toJSON(): StoredBallotSubmission {
        return { transaction: TransactionHash.toHexString(this.transaction), status: this.status };
    }

    /** Change the status of a ballot submission. Returns new ballot submission instead of mutating. */
    public changeStatus(status: BallotSubmissionStatus): BallotSubmission {
        return new BallotSubmission(this.transaction, status);
    }

    /** Checks if two ballot submissions are equal. */
    public eq(other: BallotSubmission) {
        return TransactionHash.equals(this.transaction, other.transaction);
    }
}

const submittedBallotsAtomFamily = atomFamily(
    (account: AccountAddress.Type) =>
        /** Base atom which handles storing the values both in memory and in localstorage */
        atomWithStorage<StoredBallotSubmission[]>(
            `ccd-gc-election.submissions.${AccountAddress.toBase58(account)}`,
            [],
            undefined,
            { unstable_getOnInit: true }, // Needed to load values from localstorage on init.
        ),
    (a, b) => a.address === b.address,
);

const currentAccountSubmittedBallotsAtom = atom(
    (get) => {
        const wallet = get(activeWalletAtom);
        if (wallet?.account === undefined) {
            return undefined;
        }

        const baseAtom = submittedBallotsAtomFamily(wallet.account);
        return get(baseAtom).map(BallotSubmission.fromSerializable);
    },
    (get, set, update: BallotSubmission[]) => {
        const account = expectValue(
            get(activeWalletAtom)?.account,
            'Cannot update ballot submissions without an active account',
        );
        const baseAtom = submittedBallotsAtomFamily(account);
        set(
            baseAtom,
            update.map((u) => u.toJSON()),
        );
    },
);


/**
 * Monitors the status of a single {@linkcode BallotSubmission} until `abortSignal` is received.
 */
async function monitorAccountSubmission(
    submission: BallotSubmission,
    grpc: ConcordiumGRPCClient,
    abortSignal: AbortSignal,
    setStatus: (status: BallotSubmissionStatus) => void,
) {
    abortSignal.addEventListener('abort', () => {
        console.log('Aborted monitoring ballot submission for:', submission);
    });

    if (submission.status === BallotSubmissionStatus.Committed) {
        const outcome = await grpc.waitForTransactionFinalization(submission.transaction);
        if (outcome.summary.type !== TransactionSummaryType.AccountTransaction) {
            throw new Error('Expected account transaction');
        }

        if (!abortSignal.aborted) {
            const success = outcome.summary.transactionType !== TransactionKindString.Failed;
            setStatus(success ? BallotSubmissionStatus.Approved : BallotSubmissionStatus.Rejected);
        }
    }
    if (submission.status === BallotSubmissionStatus.Approved) {
        // TODO: Poll the election server
    }
}

const ballotMonitorAtom = atomEffect((get, set) => {
    const wallet = get(activeWalletAtom);
    const ballots = get(currentAccountSubmittedBallotsAtom) ?? [];
    if (wallet === undefined || ballots.length === 0) {
        return;
    }

    // Get the best possible GRPC client: browser wallet > NETWORK
    let grpc: ConcordiumGRPCClient;
    if (wallet?.connection instanceof BrowserWalletConnector) {
        grpc = new ConcordiumGRPCClient(wallet.connection.getGrpcTransport());
    } else {
        const grpcOpts = expectValue(NETWORK.grpcOpts, 'Expected GRPC options to be available');
        grpc = new ConcordiumGRPCClient(new GrpcWebFetchTransport(grpcOpts));
    }

    const abortController = new AbortController();
    const setStatus = (ballot: BallotSubmission) => (status: BallotSubmissionStatus) => {
        const current = expectValue(get(currentAccountSubmittedBallotsAtom), 'Expected submitted ballots');
        set(currentAccountSubmittedBallotsAtom, current.map(b => b.eq(ballot) ? b.changeStatus(status): b));
    }

    ballots.forEach(b => void monitorAccountSubmission(b, grpc, abortController.signal, setStatus(b)))

    return () => {
        abortController.abort();
    };
});

/**
 * Holds the ballots submitted for the currently selected account (if any).
 */
export const submittedBallotsAtom = atom((get) => {
    get(ballotMonitorAtom); // Subscribe to status updates
    return get(currentAccountSubmittedBallotsAtom);
});

/**
 * Exposes an atom setter, which adds a ballot submission to the submitted ballots of the currently selected account.
 */
export const addSubmittedBallotAtom = atom(null, (get, set, submission: TransactionHash.Type) => {
    const ballots = expectValue(get(currentAccountSubmittedBallotsAtom), 'Could not get ballot submissions');
    set(currentAccountSubmittedBallotsAtom, [...ballots, BallotSubmission.fromTransaction(submission)]);
});
