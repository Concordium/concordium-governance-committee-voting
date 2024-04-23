import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { electionConfigAtom, guardiansStateAtom } from './store';
import { useNow } from 'shared/util';

export const enum ElectionOpenState {
    NotStarted,
    SetupIncomplete,
    Open,
    Concluded,
}

export function useIsElectionOpen(): ElectionOpenState | undefined {
    const electionConfig = useAtomValue(electionConfigAtom);
    const guardians = useAtomValue(guardiansStateAtom);
    const now = useNow(1);

    const isElectionOpen = useMemo(() => {
        if (electionConfig === undefined) {
            return undefined;
        }

        if (electionConfig.start > now) {
            return ElectionOpenState.NotStarted;
        }
        if (!guardians?.setupDone) {
            return ElectionOpenState.SetupIncomplete;
        }
        if (electionConfig.end < now) {
            return ElectionOpenState.Concluded;
        }
        return ElectionOpenState.Open;
    }, [electionConfig, now, guardians]);

    return isElectionOpen;
}
