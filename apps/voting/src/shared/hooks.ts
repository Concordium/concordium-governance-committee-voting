import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { activeWalletAtom, electionConfigAtom } from './store';

export const enum ElectionOpenState {
    NotStarted,
    Open,
    Concluded,
}

export function useIsElectionOpen(): ElectionOpenState | undefined {
    const electionConfig = useAtomValue(electionConfigAtom);

    const isElectionOpen = useMemo(() => {
        if (electionConfig?.start === undefined || electionConfig.end === undefined) {
            return undefined;
        }
        const now = new Date();
        if (electionConfig.start > now) {
            return ElectionOpenState.NotStarted;
        }
        if (electionConfig.end < now) {
            return ElectionOpenState.Concluded;
        }
        return ElectionOpenState.Open;
    }, [electionConfig]);

    return isElectionOpen;
}

/**
 * Possible values describing whether a user can cast votes in the election.
 */
export const enum EligibleStatus {
    /** Either election config or account connection missing */
    MissingValues,
    /** Account ineligible for voting */
    Ineligible,
    /** Account eligible for voting */
    Eligible,
}

/**
 * Returns a {@linkcode EligibleStatus} describing whether a user account can cast votes.
 */
export function useCanVote(): EligibleStatus {
    const electionConfig = useAtomValue(electionConfigAtom);
    const activeWallet = useAtomValue(activeWalletAtom);

    if (electionConfig === undefined || activeWallet?.account === undefined) {
        return EligibleStatus.MissingValues;
    }

    // TODO: change to query status from election server
    return EligibleStatus.Eligible;
    // return AccountAddress.toBase58(activeWallet.account) in electionConfig.voters
    //     ? EligibleStatus.Eligible
    //     : EligibleStatus.Ineligible;
}
