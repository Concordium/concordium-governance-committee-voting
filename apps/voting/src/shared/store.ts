import { atom } from 'jotai';
import { atomWithReset, atomWithStorage } from 'jotai/utils';
import { HexString } from '@concordium/web-sdk';
import { Buffer } from 'buffer/';
import { ChecksumUrl, ElectionContract, getElectionConfig } from './election-contract';
import { isDefined } from './util';

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

interface ElectionConfig extends Omit<ElectionContract.ReturnValueViewConfig, 'candidates'> {
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

        const checksum = await window.crypto.subtle.digest('SHA-256', bData).then((b) => Buffer.from(b).toString('hex'));
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
electionConfigBaseAtom.onMount = (setAtom) => {
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

interface BallotSubmission {
    transaction: HexString;
    selectedCandidates: number[];
}

const submittedBallotsAtomBase = atomWithStorage<BallotSubmission[]>('ccd-gc-election.submissions', []);
export const submittedBallotsAtom = atom((get) => get(submittedBallotsAtomBase));
export const addSubmittedBallotAtom = atom(null, (get, set, submission: BallotSubmission) => {
    set(submittedBallotsAtomBase, [...get(submittedBallotsAtomBase), submission]);
});
