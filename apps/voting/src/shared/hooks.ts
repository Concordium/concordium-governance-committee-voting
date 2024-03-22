import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { electionConfigAtom } from './store';
import { useNow } from 'shared/util';

export const enum ElectionOpenState {
    NotStarted,
    SetupError,
    Open,
    Concluded,
}

export function useIsElectionOpen(): ElectionOpenState | undefined {
    const electionConfig = useAtomValue(electionConfigAtom);
    const now = useNow(1);

    const isElectionOpen = useMemo(() => {
        if (electionConfig === undefined) {
            return undefined;
        }

        if (electionConfig.start > now) {
            return ElectionOpenState.NotStarted;
        }
        if (!electionConfig.setupDone) {
            return ElectionOpenState.SetupError;
        }
        if (electionConfig.end < now) {
            return ElectionOpenState.Concluded;
        }
        return ElectionOpenState.Open;
    }, [electionConfig, now]);

    return isElectionOpen;
}
