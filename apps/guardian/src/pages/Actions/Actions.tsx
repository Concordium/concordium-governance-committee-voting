import { useAtomValue } from 'jotai';
import SetupActions from './SetupActions';
import { electionConfigAtom } from '~/shared/store';
import { useNow } from 'shared/util';
import { useMemo } from 'react';

/**
 * Represents the different phases of the election
 */
const enum ElectionPhase {
    Setup,
    Election,
    Finalization,
}

/**
 * Component which contains the guardian actions available at the current stage of the election.
 */
export default function Actions() {
    const electionConfig = useAtomValue(electionConfigAtom);
    const now = useNow();
    const phase = useMemo(() => {
        if (electionConfig === undefined) {
            return undefined;
        }

        if (now < electionConfig.electionStart) return ElectionPhase.Setup;
        if (now > electionConfig.electionEnd) return ElectionPhase.Finalization;
        return ElectionPhase.Election;
    }, [now, electionConfig]);

    if (electionConfig === undefined) {
        return null;
    }

    return (
        <>
            {phase === ElectionPhase.Setup && <SetupActions />}
            {phase === ElectionPhase.Election && <>Waiting for voting to conclude...</>}
            {phase === ElectionPhase.Setup && <>Finalization phase...</>}
        </>
    );
}
