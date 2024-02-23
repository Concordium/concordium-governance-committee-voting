import { useAtomValue } from 'jotai';
import { FC, PropsWithChildren } from 'react';
import { ElectionPhase, TallyStep, electionStepAtom, guardiansStateAtom } from '~/shared/store';
import { ActionStep, AwaitPeers, Step, makeActionableStep } from './util';
import { registerDecryptionProofs, registerDecryptionShares } from '~/shared/ffi';
import { CcdAmount } from '@concordium/web-sdk';
import { Modal } from 'react-bootstrap';
import { CCD_SYMBOL } from 'shared/util';
import Button from '~/shared/Button';

const DecryptionError: FC<PropsWithChildren> = ({ children }) => (
    <>
        <h1 className="text-danger">Error:</h1>
        <h3>{children}</h3>
        <p>Please report this to the election facilitator.</p>
    </>
);

const GenerateDecryptionShare = makeActionableStep(
    registerDecryptionShares,
    ({ initFlow, proposal, error, step, acceptProposal, rejectProposal, isOpen, hide }) => (
        <>
            <Button onClick={initFlow} disabled={isOpen} size="lg">
                Generate decryption share
            </Button>
            <p className="text-muted mt-3">
                Reads the encrypted tally from the election smart contract and generates your share of the tally
                decryption.
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
                            note={
                                proposal ? `Transaction fee: ${CCD_SYMBOL}${CcdAmount.toCcd(proposal).toString()}` : ``
                            }
                        >
                            Awaiting transaction approval
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
    ),
);

const GenerateDecryptionProof = makeActionableStep(
    registerDecryptionProofs,
    ({ initFlow, proposal, error, step, acceptProposal, rejectProposal, isOpen, hide }) => (
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
                            note={
                                proposal ? `Transaction fee: ${CCD_SYMBOL}${CcdAmount.toCcd(proposal).toString()}` : ``
                            }
                        >
                            Awaiting transaction approval
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
    ),
);

export function DecryptionActions() {
    const electionStep = useAtomValue(electionStepAtom);
    const { guardians } = useAtomValue(guardiansStateAtom);

    if (electionStep?.phase !== ElectionPhase.Tally || guardians === undefined) {
        return null;
    }

    const { step } = electionStep;

    return (
        <>
            {step === TallyStep.AwaitEncryptedTally && <>Waiting for tally to be registered</>}
            {step === TallyStep.TallyError && <DecryptionError>Could not read the election tally</DecryptionError>}
            {step === TallyStep.GenerateDecryptionShare && <GenerateDecryptionShare />}
            {step === TallyStep.AwaitPeerShares && (
                <AwaitPeers predicate={(g) => g.hasDecryptionShare}>
                    Waiting for peers to register their shares of the decryption
                </AwaitPeers>
            )}
            {step === TallyStep.GenerateDecryptionProof && <GenerateDecryptionProof />}
            {step === TallyStep.Done && (
                <AwaitPeers predicate={(g) => g.hasDecryptionProof}>
                    Your decryption is complete. Combined decryption progress:
                </AwaitPeers>
            )}
        </>
    );
}
