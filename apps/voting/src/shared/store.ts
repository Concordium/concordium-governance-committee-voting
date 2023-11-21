import { atom } from "jotai";
import {atomWithReset, atomWithStorage} from 'jotai/utils'
import { ElectionContract, getElectionConfig } from "./election-contract";
import { HexString } from "@concordium/web-sdk";

const electionConfigBaseAtom = atom<ElectionContract.ReturnValueViewConfig | undefined>(undefined);
electionConfigBaseAtom.onMount = (setAtom) => {
    void getElectionConfig().then(setAtom);
}
export const electionConfigAtom = atom((get) => get(electionConfigBaseAtom));

export const selectConnectionAtom = atomWithReset<(() => void) | undefined>(undefined);

interface BallotSubmission {
    transaction: HexString;
    selectedCandidates: number[];
}

const submittedBallotsAtomBase = atomWithStorage<BallotSubmission[]>('ccd-gc-election.submissions', []);
export const submittedBallotsAtom = atom((get) => get(submittedBallotsAtomBase));
export const addSubmittedBallotAtom = atom(null, (get, set, submission: BallotSubmission) => {
    set(submittedBallotsAtomBase, [...get(submittedBallotsAtomBase), submission])
});
