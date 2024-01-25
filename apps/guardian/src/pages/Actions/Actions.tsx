import { clsx } from 'clsx';
import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Spinner } from 'react-bootstrap';

import Button from '~/shared/Button';
import SuccessIcon from '~/assets/rounded-success.svg?react';
import ErrorIcon from '~/assets/rounded-warning.svg?react';
import { generateKeyPair } from '~/shared/ffi';

const enum GenerateStep {
    Generate,
    ApproveTransaction,
    UpdateConctract,
    Done,
}

type StepProps = PropsWithChildren<{
    activeStep: GenerateStep;
    step: GenerateStep;
    error?: string;
    note?: string;
}>;

const enum StepStatus {
    Inactive,
    Active,
    Success,
    Error,
}

function Step({ step, activeStep, error, children, note }: StepProps) {
    const ownError = step === activeStep ? error : undefined;
    const status = useMemo(() => {
        if (step > activeStep) {
            return StepStatus.Inactive;
        }
        if (step < activeStep) {
            return StepStatus.Success;
        }

        return ownError !== undefined ? StepStatus.Error : StepStatus.Active;
    }, [ownError, step, activeStep]);

    return (
        <li
            className={clsx(
                'generate__step',
                status === StepStatus.Active && 'generate__step--active',
                status === StepStatus.Error && 'generate__step--error',
                status === StepStatus.Success && 'generate__step--success',
            )}
        >
            <div className="generate__step-icon">
                {status === StepStatus.Active && <Spinner animation="border" size="sm" />}
                {status === StepStatus.Error && <ErrorIcon width="20" />}
                {status === StepStatus.Success && <SuccessIcon width="20" />}
            </div>
            <div>
                {children}
                <div className={clsx('generate__step-note', ownError ? 'text-danger' : 'text-muted')}>
                    {ownError ?? note}
                </div>
            </div>
        </li>
    );
}

function GenerateGuardianKey() {
    const [show, setShow] = useState(false);
    const [error, setError] = useState<string>();
    const [step, setStep] = useState<GenerateStep>(GenerateStep.Generate);
    const [pubKey, setPubKey] = useState<unknown>();

    const sendUpdate = useCallback(() => {
        console.log(pubKey); // Send the transaction.
        setStep(GenerateStep.UpdateConctract);
    }, [pubKey]);

    useEffect(() => {
        if (show) {
            void generateKeyPair()
                .then((value) => {
                    setPubKey(value);
                    setStep(GenerateStep.ApproveTransaction);
                })
                .catch((e: Error) => {
                    setError(e.message);
                });
        }
    }, [show]);

    return (
        <>
            <Button onClick={() => setShow(true)} disabled={show}>
                Generate guardian key
            </Button>
            <Modal show={show} centered animation>
                <Modal.Header>Generating guardian key</Modal.Header>
                <Modal.Body>
                    <ul className="generate__steps">
                        <Step step={GenerateStep.Generate} activeStep={step} error={error}>
                            Generating guardian key pair
                        </Step>
                        <Step
                            step={GenerateStep.ApproveTransaction}
                            activeStep={step}
                            error={error}
                            note="Transaction fee: 230 CCD"
                        >
                            Awaiting transaction approval
                            <div className="generate__step-note text-muted"></div>
                        </Step>
                        <Step step={GenerateStep.UpdateConctract} activeStep={step} error={error}>
                            Updating election contract
                        </Step>
                    </ul>
                </Modal.Body>
                {step === GenerateStep.ApproveTransaction && (
                    <Modal.Footer className="justify-content-start">
                        <Button onClick={sendUpdate} variant="secondary">
                            Send key registration
                        </Button>
                    </Modal.Footer>
                )}
            </Modal>
        </>
    );
}

/**
 * Component which contains the guardian actions available at the current stage of the election.
 */
export default function Actions() {
    return (
        <>
            <GenerateGuardianKey />
        </>
    );
}
