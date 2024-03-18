import { useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import { useAtomValue } from 'jotai';
import { CcdAmount } from '@concordium/web-sdk';

import Button from '~/shared/Button';
import { ValidatedProposalType, generateSecretShare, registerGuardianKey, registerGuardianShares } from '~/shared/ffi';
import { CCD_SYMBOL, expectValue } from 'shared/util';
import { Countdown } from 'shared/components';
import { ElectionPhase, SetupStep, electionConfigAtom, electionStepAtom, setupCompleted } from '~/shared/store';
import { makeActionableStep, Step, ActionStep, AwaitPeers } from './util';

const GenerateGuardianKey = makeActionableStep(
    registerGuardianKey,
    ({ initFlow, proposal, error, step, acceptProposal, rejectProposal, isOpen, hide }) => (
        <>
            <Button onClick={initFlow} disabled={isOpen} size="lg">
                Generate guardian key
            </Button>
            <p className="text-muted mt-3">
                Creates your secret key (needed for decryption of the election result) and registers the corresponding
                public key, which is needed for encryption of the ballot submissions by voters.
            </p>
            <Modal show={isOpen} centered animation onHide={hide} backdrop="static" keyboard={false}>
                <Modal.Header closeButton={error !== undefined}>Generate & register guardian key</Modal.Header>
                <Modal.Body>
                    <ul className="generate__steps">
                        <Step step={ActionStep.Compute} activeStep={step} error={error}>
                            Generating guardian key pair
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
                            Registering public key in contract
                        </Step>
                    </ul>
                </Modal.Body>
                {step === ActionStep.HandleProposal && error === undefined && (
                    <Modal.Footer className="justify-content-start">
                        <Button onClick={acceptProposal} variant="secondary">
                            Send key registration
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

/**
 * Flow for generating and registering encrypted shares
 */
const GenerateEncryptedShares = makeActionableStep(
    registerGuardianShares,
    ({ initFlow, proposal, error, step, acceptProposal, rejectProposal, isOpen, hide }) => {
        const peerValidationMessage = useMemo(
            () =>
                proposal?.type === ValidatedProposalType.Complaint
                    ? 'Failed to validate the keys submitted by peer guardians.'
                    : undefined,
            [proposal],
        );

        return (
            <>
                <Button onClick={initFlow} disabled={isOpen} size="lg">
                    Generate encrypted shares
                </Button>
                <p className="text-muted mt-3">
                    Creates encrypted shares of your secret key for peers and registers them.
                    <br />
                    Peer guardians need the encrypted share of your secret key to create their share of the decryption
                    key.
                </p>
                <Modal show={isOpen} centered animation onHide={hide} backdrop="static" keyboard={false}>
                    <Modal.Header closeButton={error !== undefined}>
                        Generate & register encrypted shares of guardian key
                    </Modal.Header>
                    <Modal.Body>
                        <ul className="generate__steps">
                            <Step
                                step={ActionStep.Compute}
                                activeStep={step}
                                error={error}
                                warn={peerValidationMessage !== undefined}
                                note={peerValidationMessage}
                            >
                                Generating encrypted shares of guardian key
                            </Step>
                            <Step
                                step={ActionStep.HandleProposal}
                                activeStep={step}
                                error={error}
                                note={
                                    proposal
                                        ? `Transaction fee: ${CCD_SYMBOL}${CcdAmount.toCcd(
                                              proposal.ccdCost,
                                          ).toString()}`
                                        : ``
                                }
                            >
                                Awaiting transaction approval
                                <div className="generate__step-note text-muted"></div>
                            </Step>
                            <Step step={ActionStep.UpdateConctract} activeStep={step} error={error}>
                                {peerValidationMessage === undefined
                                    ? 'Registering encrypted shares of guardian key'
                                    : 'Registering failed validation of public keys of peers'}
                            </Step>
                        </ul>
                    </Modal.Body>
                    {step === ActionStep.HandleProposal && error === undefined && (
                        <Modal.Footer className="justify-content-start">
                            <Button onClick={acceptProposal} variant="secondary">
                                {peerValidationMessage !== undefined
                                    ? 'Register validation complaint'
                                    : 'Register encrypted shares'}
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

/**
 * Flow for generating the secret share, and registering validation of peer shares.
 */
const GenerateSecretShare = makeActionableStep(
    generateSecretShare,
    ({ initFlow, proposal, error, step, acceptProposal, rejectProposal, isOpen, hide }) => {
        const peerValidationMessage = useMemo(
            () =>
                proposal?.type === ValidatedProposalType.Complaint
                    ? 'Failed to validate the shares submitted by peer guardians.'
                    : undefined,
            [proposal],
        );

        return (
            <>
                <Button onClick={initFlow} disabled={isOpen} size="lg">
                    Generate secret key share
                </Button>
                <p className="text-muted mt-3">
                    Creates your share of the decryption key from your secret key along with the encrypted shares of the
                    secret keys of your peer guardians.
                </p>
                <Modal show={isOpen} centered animation onHide={hide} backdrop="static" keyboard={false}>
                    <Modal.Header closeButton={error !== undefined}>Generating share of secret key</Modal.Header>
                    <Modal.Body>
                        <ul className="generate__steps">
                            <Step
                                step={ActionStep.Compute}
                                activeStep={step}
                                error={error}
                                warn={peerValidationMessage !== undefined}
                                note={peerValidationMessage}
                            >
                                Generating share of secret key
                            </Step>
                            <Step
                                step={ActionStep.HandleProposal}
                                activeStep={step}
                                error={error}
                                note={
                                    proposal
                                        ? `Transaction fee: ${CCD_SYMBOL}${CcdAmount.toCcd(
                                              proposal.ccdCost,
                                          ).toString()}`
                                        : ``
                                }
                            >
                                Awaiting transaction approval
                                <div className="generate__step-note text-muted"></div>
                            </Step>
                            <Step step={ActionStep.UpdateConctract} activeStep={step} error={error}>
                                {peerValidationMessage === undefined
                                    ? 'Registering successful validation of peer shares'
                                    : 'Registering failed validation of peer shares'}
                            </Step>
                        </ul>
                    </Modal.Body>
                    {step === ActionStep.HandleProposal && error === undefined && (
                        <Modal.Footer className="justify-content-start">
                            <Button onClick={acceptProposal} variant="secondary">
                                {peerValidationMessage !== undefined
                                    ? 'Register validation complaint'
                                    : 'Register validation OK'}
                            </Button>
                            <Button variant="danger" onClick={rejectProposal}>
                                Cancel
                            </Button>
                        </Modal.Footer>
                    )}
                </Modal>
            </>
        );
    },
);

/**
 * Component shown when the setup phase is completed for all guardians.
 */
function Ready() {
    const electionConfig = expectValue(useAtomValue(electionConfigAtom), 'Expected election config to be available');

    return (
        <>
            <h1>Election setup complete</h1>
            <p>
                Election begins in <br />
                <b className="text-primary">
                    <Countdown to={electionConfig.electionStart} />
                </b>
            </p>
        </>
    );
}

/**
 * Component shown when the election has been flagged as invalid by any guardian.
 */
function Invalid() {
    return (
        <>
            <h3>A validation complaint has been registered</h3>
            <p>
                The validity of the submissions made by one or more guardians has been questioned.
                <br />
                Manual intervention by the election facilitator is required.
            </p>
        </>
    );
}

/**
 * Component shown when the election setup has not been completed prior to the election starting
 */
function Incomplete() {
    return (
        <>
            <h3>Setup phase incomplete</h3>
            <p>
                The setup phase was not completed by one or more guardians.
                <br />
                Manual intervention by the election facilitator is required.
            </p>
        </>
    );
}

/**
 * Component which shows the relevant actions/election state for the guardian during the election setup phase
 */
export default function SetupActions() {
    const electionStep = useAtomValue(electionStepAtom);

    if (electionStep?.phase !== ElectionPhase.Setup) {
        return null;
    }

    return (
        <>
            {electionStep.step === SetupStep.GenerateKey && <GenerateGuardianKey />}
            {electionStep.step === SetupStep.AwaitPeerKeys && (
                <AwaitPeers predicate={(g) => g.hasPublicKey}>
                    Waiting for other guardians to register their keys
                </AwaitPeers>
            )}
            {electionStep.step === SetupStep.GenerateEncryptedShares && <GenerateEncryptedShares />}
            {electionStep.step === SetupStep.AwaitPeerShares && (
                <AwaitPeers predicate={(g) => g.hasEncryptedShares}>
                    Waiting for other guardians to register their encrypted shares
                </AwaitPeers>
            )}
            {electionStep.step === SetupStep.GenerateSecretShare && <GenerateSecretShare />}
            {electionStep.step === SetupStep.AwaitPeerValidation && (
                <AwaitPeers predicate={setupCompleted}>
                    Waiting for other guardians to generate their secret share
                </AwaitPeers>
            )}
            {electionStep.step === SetupStep.Done && <Ready />}
            {electionStep.step === SetupStep.Invalid && <Invalid />}
            {electionStep.step === SetupStep.Incomplete && <Incomplete />}
        </>
    );
}
