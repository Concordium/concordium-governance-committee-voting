import { atom } from 'jotai';
import { atomFamily, atomWithReset, atomWithStorage } from 'jotai/utils';
import {
    AccountAddress,
    AccountTransactionType,
    ConcordiumGRPCClient,
    HexString,
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

interface CandidateDetails {
    name: string;
    imageUrl: string;
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

export interface IndexedCandidateDetails extends CandidateDetails {
    index: number;
}

export interface ElectionConfig extends Omit<ElectionContract.ReturnValueViewConfig, 'candidates'> {
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

export const electionConfigAtom = atom((get) => get(electionConfigBaseAtom));

export const selectConnectionAtom = atomWithReset<(() => void) | undefined>(undefined);

export interface Wallet {
    account: AccountAddress.Type | undefined;
    chain: string | undefined;
    connection: WalletConnection;
}

export const activeWalletAtom = atom<Wallet | undefined>(undefined);

const enum BallotSubmissionStatus {
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

export class BallotSubmission {
    constructor(
        public readonly transaction: TransactionHash.Type,
        public readonly status: BallotSubmissionStatus,
    ) { }

    public static fromSerializable(value: StoredBallotSubmission) {
        return new BallotSubmission(TransactionHash.fromHexString(value.transaction), value.status);
    }

    public toJSON(): StoredBallotSubmission {
        return { transaction: TransactionHash.toHexString(this.transaction), status: this.status };
    }

    public changeStatus(status: BallotSubmissionStatus): BallotSubmission {
        return new BallotSubmission(this.transaction, status);
    }

    public eq(other: BallotSubmission) {
        return TransactionHash.equals(this.transaction, other.transaction);
    }
}

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

interface RefCountAbortState {
    refCount: number;
    abortController: AbortController;
}

function atomRefCountAbort() {
    const baseAtom = atom<RefCountAbortState>({ refCount: 0, abortController: new AbortController() });

    const derivedAtom = atom(
        (get) => {
            const { refCount, abortController } = get(baseAtom);
            return { refCount, abortSignal: abortController.signal };
        },
        (get, set, update: 'init' | 'drop') => {
            const current = get(baseAtom);

            let refCount: number;
            if (update === 'init') {
                refCount = current.refCount + 1;
            } else {
                refCount = current.refCount - 1;
            }

            if (refCount === 0) {
                current.abortController.abort();
            }

            set(baseAtom, (v) => ({
                abortController: v.abortController.signal.aborted ? new AbortController() : v.abortController,
                refCount: refCount,
            }));
        },
    );
    derivedAtom.onMount = (setValue) => {
        setValue('init');
        return () => {
            setValue('drop');
        };
    };

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

    const abortAtom = atomRefCountAbort();

    /** Polls for submission status updates */
    const monitorAtom = atom(
        (get) => {
            get(abortAtom); // To trigger `onMount`
        },
        (get, set, action: Action) => {
            const ballots = get(jsonAtom);
            const { abortSignal, refCount } = get(abortAtom);

            if (action.type === 'init' && refCount > 1) {
                return; // Already monitoring submissions.
            }

            let checklist: BallotSubmission[] = [];
            if (action.type === 'init') {
                checklist = ballots;
            } else if (action.type === 'add') {
                const ballot = new BallotSubmission(action.submission, BallotSubmissionStatus.Committed);
                set(jsonAtom, [...ballots, ballot]);
                checklist = [ballot];
            }

            const wallet = get(activeWalletAtom);
            let grpc: ConcordiumGRPCClient;
            if (wallet?.connection instanceof BrowserWalletConnector) {
                grpc = new ConcordiumGRPCClient(wallet.connection.getGrpcTransport());
            } else if (NETWORK.grpcOpts === undefined) {
                throw new Error('Expected GRPC options to be available');
            } else {
                grpc = new ConcordiumGRPCClient(new GrpcWebFetchTransport(NETWORK.grpcOpts));
            }

            const setStatus = (submission: BallotSubmission) => (status: BallotSubmissionStatus) => {
                const current = get(jsonAtom);
                set(
                    jsonAtom,
                    current.map((b) => (b.eq(submission) ? b.changeStatus(status) : b)),
                );
            };
            checklist.forEach(
                (checklistItem) =>
                    void monitorAccountSubmission(checklistItem, grpc, abortSignal, setStatus(checklistItem)),
            );
        },
    );
    monitorAtom.onMount = (setter) => {
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

export const submittedBallotsAtom = atom((get) => {
    const wallet = get(activeWalletAtom);

    if (wallet?.account === undefined) {
        return undefined;
    }

    return get(submittedBallotsFamily(wallet.account));
});

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
