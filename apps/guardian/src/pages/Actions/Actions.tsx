import { useAtomValue } from 'jotai';
import SetupActions from './SetupActions';
import { ElectionPhase, electionConfigAtom, electionStepAtom } from '~/shared/store';
import { Navbar } from 'react-bootstrap';
import { clsx } from 'clsx';
import Button from '~/shared/Button';
import { Link } from 'react-router-dom';
import { routes } from '~/shell/router';
import { DecryptionActions } from './DecryptionActions';
import { Countdown } from 'shared/components';

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
    const electionStep = useAtomValue(electionStepAtom);
    const electionConfig = useAtomValue(electionConfigAtom);

    if (electionStep === undefined || electionConfig == null) {
        return null;
    }

    return (
        <>
            <Navbar className="bg-body-secondary px-4 justify-content-between">
                <div className="d-flex align-items-center">
                    <Phase activePhase={electionStep.phase}>{ElectionPhase.Setup}</Phase>
                    <Dots />
                    <Phase activePhase={electionStep.phase}>{ElectionPhase.Voting}</Phase>
                    <Dots />
                    <Phase activePhase={electionStep.phase}>{ElectionPhase.Tally}</Phase>
                </div>
                <Link to={routes.selectAccount.path} state={{ canBack: true }}>
                    <Button variant="outline-info" size="sm">
                        Switch account?
                    </Button>
                </Link>
            </Navbar>
            <div className="actions__body">
                {electionStep.phase === ElectionPhase.Setup && <SetupActions />}
                {electionStep.phase === ElectionPhase.Voting && (
                    <>
                        <h1 className="text-muted">Election is in progress.</h1>
                        <p>
                            Your help is needed to decrypt the election results in:
                            <br />
                            <b>
                                <Countdown to={electionConfig.electionEnd} />
                            </b>
                        </p>
                    </>
                )}
                {electionStep.phase === ElectionPhase.Tally && <DecryptionActions />}
            </div>
        </>
    );
}
