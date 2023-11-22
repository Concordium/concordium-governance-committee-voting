import { atom } from 'jotai';
import { atomFamily, atomWithReset, atomWithStorage } from 'jotai/utils';
import {
    AccountAddress,
    ConcordiumGRPCClient,
    HexString,
    TransactionHash,
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
    Committed,
    Rejected,
    Approved,
    Included,
}

export interface BallotSubmission {
    transaction: TransactionHash.Type;
    status: BallotSubmissionStatus;
}

interface StoredBallotSubmission {
    transaction: HexString;
    status: BallotSubmissionStatus;
}

interface InitAction {
    type: 'init';
}

interface AddAction {
    type: 'add';
    submission: TransactionHash.Type;
}

type Action = InitAction | AddAction;

const submittedBallotsBaseAtom = atomFamily((account: AccountAddress.Type) => {
    const baseAtom = atomWithStorage<StoredBallotSubmission[]>(
        `ccd-gc-election.submissions.${AccountAddress.toBase58(account)}`,
        [],
        undefined,
        { unstable_getOnInit: true },
    );

    const jsonAtom = atom(
        (get) => {
            const json = get(baseAtom);
            return json.map((j) => ({ ...j, transaction: TransactionHash.fromHexString(j.transaction) }));
        },
        (get, set, update: BallotSubmission[]) => {
            set(baseAtom, [
                ...get(baseAtom),
                ...update.map((u) => ({ ...u, transaction: TransactionHash.toHexString(u.transaction) })),
            ]);
        },
    );
    const derived = atom(
        (get) => get(jsonAtom),
        (get, set, action: Action) => {
            const ballots = get(jsonAtom);
            const wallet = get(activeWalletAtom);

            let grpc: ConcordiumGRPCClient | undefined;
            if (wallet?.connection instanceof BrowserWalletConnector) {
                grpc = new ConcordiumGRPCClient(wallet.connection.getGrpcTransport());
            } else if (NETWORK.grpcOpts !== undefined) {
                grpc = new ConcordiumGRPCClient(new GrpcWebFetchTransport(NETWORK.grpcOpts));
            }

            console.log(grpc);

            let checklist: TransactionHash.Type[] = [];
            if (action.type === 'add') {
                set(jsonAtom, [
                    ...ballots,
                    {
                        transaction: action.submission,
                        status: BallotSubmissionStatus.Committed,
                    },
                ]);

                checklist = [action.submission];

                if (grpc === undefined) {
                    return;
                }

            } else if (action.type === 'init') {
                checklist = ballots.map((b) => b.transaction);
            }

            // TODO: poll `checklist` submissions for status changes
            console.log(checklist);
        },
    );
    derived.onMount = (setter) => {
        void setter({ type: 'init' });
    };
    return derived;
});

export const submittedBallotsAtom = atom((get) => {
    const wallet = get(activeWalletAtom);

    if (wallet?.account === undefined) {
        return undefined;
    }

    return get(submittedBallotsBaseAtom(wallet.account));
});

export const addSubmittedBallotAtom = atom(null, (get, set, submission: TransactionHash.Type) => {
    const wallet = get(activeWalletAtom);
    if (wallet?.account === undefined) {
        throw new Error('Cannot add ballot submission without a connected account');
    }

    const base = submittedBallotsBaseAtom(wallet?.account);
    set(base, {
        type: 'add',
        submission,
    });
});
