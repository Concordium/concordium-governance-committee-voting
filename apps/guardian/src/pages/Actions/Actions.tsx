import { useAtomValue } from 'jotai';
import SetupActions from './SetupActions';
import { electionConfigAtom } from '~/shared/store';
import { useNow } from 'shared/util';
import { useMemo } from 'react';
import { Navbar } from 'react-bootstrap';
import { clsx } from 'clsx';
import Button from '~/shared/Button';
import { Link } from 'react-router-dom';
import { routes } from '~/shell/router';

/**
 * Represents the different phases of the election
 */
const enum ElectionPhase {
    Setup = 'Setup',
    Voting = 'Voting',
    Tally = 'Tally',
}

const Dots = () => <div className="actions__header-dots">• • • • •</div>;

type PhaseProps = { activePhase: ElectionPhase; children: ElectionPhase };
const Phase = ({ children, activePhase }: PhaseProps) => (
    <Navbar.Text className={clsx('actions__header-phase', children === activePhase && 'actions__header-phase--active')}>
        {children}
    </Navbar.Text>
);

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
        if (now > electionConfig.electionEnd) return ElectionPhase.Tally;
        return ElectionPhase.Voting;
    }, [now, electionConfig]);

    if (electionConfig === undefined || phase === undefined) {
        return null;
    }

    return (
        <>
            <Navbar className="bg-body-secondary px-4 justify-content-between">
                <div className='d-flex align-items-center'>
                    <Phase activePhase={phase}>{ElectionPhase.Setup}</Phase>
                    <Dots />
                    <Phase activePhase={phase}>{ElectionPhase.Voting}</Phase>
                    <Dots />
                    <Phase activePhase={phase}>{ElectionPhase.Tally}</Phase>
                </div>
                <Link to={routes.selectAccount.path} state={{canBack: true}}>
                    <Button variant='outline-info' size='sm'>Switch account?</Button>
                </Link>
            </Navbar>
            {phase === ElectionPhase.Setup && <SetupActions />}
            {phase === ElectionPhase.Voting && <>Waiting for voting to conclude...</>}
            {phase === ElectionPhase.Setup && <>Finalization phase...</>}
        </>
    );
}
