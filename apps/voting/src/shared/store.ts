import { atom } from 'jotai';
import { atomFamily, atomWithReset, atomWithStorage } from 'jotai/utils';
import {
    AccountAddress,
    ConcordiumGRPCClient,
    TransactionHash,
    TransactionKindString,
    TransactionSummaryType,
} from '@concordium/web-sdk';
import { Buffer } from 'buffer/';
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport';
import { BrowserWalletConnector, WalletConnection } from '@concordium/wallet-connectors';

import { ChecksumUrl, ElectionContract, getElectionConfig } from './election-contract';
import { isDefined } from './util';
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
export interface ElectionConfig extends Omit<ElectionContract.ReturnValueViewConfig, 'candidates'> {
    /** The election candidates */
    candidates: IndexedCandidateDetails[];
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

/**
 * Monitors the status of a single {@linkcode BallotSubmission} until `abortSignal` is received.
 */
async function monitorAccountSubmission(
    submission: BallotSubmission,
    grpc: ConcordiumGRPCClient,
    abortSignal: AbortSignal,
    setStatus: (status: BallotSubmissionStatus) => void,
) {
    if (submission.status === BallotSubmissionStatus.Committed) {
        const outcome = await grpc.waitForTransactionFinalization(submission.transaction);
        if (outcome.summary.type !== TransactionSummaryType.AccountTransaction) {
            throw new Error('Expected account transaction');
        }

        const success = outcome.summary.transactionType !== TransactionKindString.Failed;
        setStatus(success ? BallotSubmissionStatus.Approved : BallotSubmissionStatus.Rejected);
    }
    if (submission.status === BallotSubmissionStatus.Approved) {
        return new Promise<void>((resolve) => {
            abortSignal.addEventListener('abort', () => {
                console.log('Aborted monitoring ballot submission for:', submission);
                resolve();
            });
            // TODO: Poll the election server
        });
    }
}

function atomAbort() {
    const baseAtom = atom<AbortController>(new AbortController());

    const derivedAtom = atom(
        (get) => get(baseAtom).signal,
        (get, set) => {
            const current = get(baseAtom);
            current.abort();
            set(baseAtom, (v) => (v.signal.aborted ? new AbortController() : v));
        },
    );
    derivedAtom.onMount = (abort) => () => abort();

    return atom((get) => get(derivedAtom));
}

interface InitAction {
    type: 'init';
}

interface AddAction {
    type: 'add';
    submission: TransactionHash.Type;
}

type Action = InitAction | AddAction;

const submittedBallotsFamily = atomFamily((account: AccountAddress.Type) => {
    /** Base atom which handles storing the values both in memory and in localstorage */
    const baseAtom = atomWithStorage<StoredBallotSubmission[]>(
        `ccd-gc-election.submissions.${AccountAddress.toBase58(account)}`,
        [],
        undefined,
        { unstable_getOnInit: true }, // Needed to load values from localstorage on init.
    );

    /** Handles converting to/from serializable format */
    const jsonAtom = atom(
        (get) => {
            const json = get(baseAtom);
            return json.map(BallotSubmission.fromSerializable);
        },
        (_, set, update: BallotSubmission[]) => {
            set(
                baseAtom,
                update.map((u) => u.toJSON()),
            );
        },
    );

    /** Holds the abort controller used to stop monitoring on unmount */
    const abortAtom = atomAbort();

    /** Polls for submission status updates */
    const monitorAtom = atom(
        (get) => {
            get(abortAtom); // To trigger `onMount`
        },
        (get, set, action: Action) => {
            const ballots = get(jsonAtom);

            // Figure out which ballots to monitor status for
            let monitorList: BallotSubmission[] = [];
            if (action.type === 'init') {
                monitorList = ballots;
            } else if (action.type === 'add') {
                const ballot = new BallotSubmission(action.submission, BallotSubmissionStatus.Committed);
                set(jsonAtom, [...ballots, ballot]);
                monitorList = [ballot];
            }

            // Get the best possible GRPC client: browser wallet > NETWORK
            const wallet = get(activeWalletAtom);
            let grpc: ConcordiumGRPCClient;
            if (wallet?.connection instanceof BrowserWalletConnector) {
                grpc = new ConcordiumGRPCClient(wallet.connection.getGrpcTransport());
            } else if (NETWORK.grpcOpts === undefined) {
                throw new Error('Expected GRPC options to be available');
            } else {
                grpc = new ConcordiumGRPCClient(new GrpcWebFetchTransport(NETWORK.grpcOpts));
            }

            const abortSignal = get(abortAtom);
            const setStatus = (submission: BallotSubmission) => (status: BallotSubmissionStatus) => {
                set(
                    jsonAtom,
                    get(jsonAtom).map((b) => (b.eq(submission) ? b.changeStatus(status) : b)),
                );
            };
            // Start monitoring the status for the ballot submissions
            monitorList.forEach(
                (monitorListItem) =>
                    void monitorAccountSubmission(monitorListItem, grpc, abortSignal, setStatus(monitorListItem)),
            );
        },
    );
    monitorAtom.onMount = (setter) => {
        console.log('monitorAtom init');
        void setter({ type: 'init' });
    };

    /** Exposes `AddAction` update and parsed value */
    const derivedAtom = atom(
        (get) => {
            get(monitorAtom); // To trigger `onMount`
            return get(jsonAtom);
        },
        (_, set, update: AddAction) => {
            set(monitorAtom, update);
        },
    );
    return derivedAtom;
});

/**
 * Holds the ballots submitted for the currently selected account (if any).
 */
export const submittedBallotsAtom = atom((get) => {
    const wallet = get(activeWalletAtom);

    if (wallet?.account === undefined) {
        return undefined;
    }

    return get(submittedBallotsFamily(wallet.account));
});

/**
 * Exposes an atom setter, which adds a ballot submission to the submitted ballots of the currently selected account.
 */
export const addSubmittedBallotAtom = atom(null, (get, set, submission: TransactionHash.Type) => {
    const wallet = get(activeWalletAtom);
    if (wallet?.account === undefined) {
        throw new Error('Cannot add ballot submission without a connected account');
    }

    const base = submittedBallotsFamily(wallet?.account);
    set(base, {
        type: 'add',
        submission,
    });
});
