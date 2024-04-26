import { useAtomValue } from 'jotai';
import { FC, PropsWithChildren } from 'react';
import { CcdAmount } from '@concordium/web-sdk';
import { Modal } from 'react-bootstrap';

import { CCD_SYMBOL, expectValue } from 'shared/util';
import { Countdown } from 'shared/components';

import Button from '~/shared/Button';
import {
    ElectionPhase,
    TallyStep,
    electionConfigAtom,
    electionStepAtom,
    guardiansStateAtom,
    selectedGuardianAtom,
} from '~/shared/store';
import { ActionStep, AwaitPeers, Step, makeActionableStep } from './util';
import { registerDecryptionProofs, registerDecryptionShares } from '~/shared/ffi';

const DecryptionError: FC<PropsWithChildren> = ({ children }) => (
    <>
        <h1 className="text-danger">Error:</h1>
        <h3>{children}</h3>
        <p>Please report this to the election coordinator.</p>
    </>
);

const GenerateDecryptionShare = makeActionableStep(
    registerDecryptionShares,
    ({ initFlow, proposal, error, step, acceptProposal, rejectProposal, isOpen, hide }) => {
        const electionConfig = expectValue(
            useAtomValue(electionConfigAtom),
            'Expected election config to be available',
        );

        return (
            <>
                <Button onClick={initFlow} disabled={isOpen} size="lg">
                    Generate decryption share
                </Button>
                <p className="text-muted mt-3">
                    Reads the encrypted tally from the election smart contract and generates your share of the tally
                    decryption.
                </p>
                <p>
                    The deadline for registering your decryption is:
                    <br />
                    <b>
                        <Countdown to={electionConfig.decryptionDeadline} />
                    </b>
                </p>
                <Modal show={isOpen} centered animation onHide={hide} backdrop="static" keyboard={false}>
                    <Modal.Header closeButton={error !== undefined}>Generate & register decryption share</Modal.Header>
                    <Modal.Body>
                        <ul className="generate__steps">
                            <Step step={ActionStep.Compute} activeStep={step} error={error}>
                                Generating decryption share
                            </Step>
                            <Step
                                step={ActionStep.HandleProposal}
                                activeStep={step}
                                error={error}
                                action
                                note={
                                    proposal
                                        ? `Transaction fee: ${CCD_SYMBOL}${CcdAmount.toCcd(proposal).toString()}`
                                        : ``
                                }
                            >
                                Send share registration
                                <div className="generate__step-note text-muted"></div>
                            </Step>
                            <Step step={ActionStep.UpdateConctract} activeStep={step} error={error}>
                                Registering decryption share in contract
                            </Step>
                        </ul>
                    </Modal.Body>
                    {step === ActionStep.HandleProposal && error === undefined && (
                        <Modal.Footer className="justify-content-start">
                            <Button onClick={acceptProposal} variant="secondary">
                                Send share registration
                            </Button>
                            <Button variant="outline-danger" onClick={rejectProposal}>
                                Cancel
                            </Button>
                        </Modal.Footer>
                    )}
                </Modal>
            </>
        );
    },
);

const GenerateDecryptionProof = makeActionableStep(
    registerDecryptionProofs,
    ({ initFlow, proposal, error, step, acceptProposal, rejectProposal, isOpen, hide }) => {
        const { hasDecryptionShare } = expectValue(
            useAtomValue(selectedGuardianAtom),
            'Expected selected guardian state to be available',
        );

        if (!hasDecryptionShare) {
            return <h1>Deadline for registering your share of the tally decryption has passed.</h1>;
        }

        return (
            <>
                <Button onClick={initFlow} disabled={isOpen} size="lg">
                    Generate decryption proof
                </Button>
                <p className="text-muted mt-3">Generates a proof of correct decryption for each decryption share.</p>
                <Modal show={isOpen} centered animation onHide={hide} backdrop="static" keyboard={false}>
                    <Modal.Header closeButton={error !== undefined}>
                        Generate & register proof of correct decryption
                    </Modal.Header>
                    <Modal.Body>
                        <ul className="generate__steps">
                            <Step step={ActionStep.Compute} activeStep={step} error={error}>
                                Generating proof of correct decryption
                            </Step>
                            <Step
                                step={ActionStep.HandleProposal}
                                activeStep={step}
                                error={error}
                                action
                                note={
                                    proposal
                                        ? `Transaction fee: ${CCD_SYMBOL}${CcdAmount.toCcd(proposal).toString()}`
                                        : ``
                                }
                            >
                                Send proof registration
                                <div className="generate__step-note text-muted"></div>
                            </Step>
                            <Step step={ActionStep.UpdateConctract} activeStep={step} error={error}>
                                Registering decryption proof in contract
                            </Step>
                        </ul>
                    </Modal.Body>
                    {step === ActionStep.HandleProposal && error === undefined && (
                        <Modal.Footer className="justify-content-start">
                            <Button onClick={acceptProposal} variant="secondary">
                                Send proof registration
                            </Button>
                            <Button variant="outline-danger" onClick={rejectProposal}>
                                Cancel
                            </Button>
                        </Modal.Footer>
                    )}
                </Modal>
            </>
        );
    },
);

export function DecryptionActions() {
    const electionStep = useAtomValue(electionStepAtom);
    const guardians = useAtomValue(guardiansStateAtom).guardians?.filter(([, g]) => !g.excluded);
    const electionConfig = useAtomValue(electionConfigAtom);

    if (electionStep?.phase !== ElectionPhase.Tally || guardians === undefined || electionConfig === undefined) {
        return null;
    }

    const { step } = electionStep;

    return (
        <>
            {step === TallyStep.AwaitEncryptedTally && <h3>Waiting for tally to be registered</h3>}
            {step === TallyStep.TallyError && <DecryptionError>Could not read the election tally</DecryptionError>}
            {step === TallyStep.Excluded && <h3>The guardian account is excluded from participating in the tally</h3>}
            {step === TallyStep.GenerateDecryptionShare && <GenerateDecryptionShare />}
            {step === TallyStep.AwaitPeerShares && (
                <AwaitPeers
                    guardians={guardians}
                    predicate={(g) => g.hasDecryptionShare}
                    note={
                        <>
                            The window for registering decryption shares closes in: <br />
                            <b>
                                <Countdown to={electionConfig.decryptionDeadline} />
                            </b>
                        </>
                    }
                >
                    Waiting for peers to register their shares of the decryption.
                </AwaitPeers>
            )}
            {step === TallyStep.Incomplete && (
                <h3>The decryption was not completed by a sufficient amount of guardians</h3>
            )}
            {step === TallyStep.GenerateDecryptionProof && <GenerateDecryptionProof />}
            {step === TallyStep.AwaitPeerProofs && (
                <AwaitPeers
                    predicate={(g) => g.hasDecryptionProof}
                    guardians={guardians.filter(([, gs]) => gs.hasDecryptionShare)}
                >
                    Your decryption is complete. Combined decryption progress:
                </AwaitPeers>
            )}
            {step === TallyStep.Done && <h3>Decryption complete.</h3>}
        </>
    );
}
