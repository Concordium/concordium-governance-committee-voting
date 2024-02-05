import { clsx } from 'clsx';
import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ProgressBar, Spinner } from 'react-bootstrap';

import Button from '~/shared/Button';
import SuccessIcon from '~/assets/rounded-success.svg?react';
import ErrorIcon from '~/assets/rounded-warning.svg?react';
import { BackendError, GuardiansState, registerGuardianKey } from '~/shared/ffi';
import { AccountAddress, Energy } from '@concordium/web-sdk';
import { sleep } from 'shared/util';
import { useAtomValue, useSetAtom } from 'jotai';
import { ElectionPhase, SetupStep, electionStepAtom, guardiansStateAtom, selectedAccountAtom } from '~/shared/store';

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

/**
 * Flow for generating a guardian key
 */
function GenerateGuardianKey() {
    const [show, setShow] = useState(false);
    const [error, setError] = useState<string>();
    const [step, setStep] = useState<GenerateStep>(GenerateStep.Generate);
    const [energy, setEnergy] = useState<Energy.Type>();
    const [registerKeyGenerator, setRegisterKeyGenerator] =
        useState<ReturnType<typeof registerGuardianKey>>(registerGuardianKey());
    const refreshGuardians = useSetAtom(guardiansStateAtom);

    /**
     * Reset the component to its initial state
     */
    const reset = useCallback(() => {
        setShow(false);
        setEnergy(undefined);
        setError(undefined);
        setStep(GenerateStep.Generate);
        setRegisterKeyGenerator(registerGuardianKey());
    }, []);

    /**
     * Sends the contract update by accepting the proposed transaction
     */
    const acceptTransactionProposal = useCallback(() => {
        if (registerKeyGenerator === undefined) {
            throw new Error('Expected interaction generator to still be available');
        }

        setStep(GenerateStep.UpdateConctract);
        registerKeyGenerator
            .next(true)
            .then(() => {
                setStep(GenerateStep.Done);
                return sleep(2000); // Allow user to see the successful contract update step
            })
            .then(refreshGuardians)
            .then(reset)
            .catch((e: BackendError) => {
                setError(e.message);
            });
    }, [registerKeyGenerator, reset, refreshGuardians]);

    /**
     * Reject the proposed transaction.
     */
    const cancel = useCallback(() => {
        if (registerKeyGenerator === undefined) {
            throw new Error('Expected interaction generator to still be available');
        }

        void registerKeyGenerator.next(false);
        reset();
    }, [registerKeyGenerator, reset]);

    // Runs when modal shows
    useEffect(() => {
        if (show && registerKeyGenerator !== undefined) {
            registerKeyGenerator
                .next()
                .then((res) => {
                    setEnergy(res.value as Energy.Type);
                    setStep(GenerateStep.ApproveTransaction);
                })
                .catch((e: BackendError) => {
                    setError(e.message);
                });
        }
    }, [show, registerKeyGenerator]);

    return (
        <>
            <Button onClick={() => setShow(true)} disabled={show} size="lg">
                Generate guardian key
            </Button>
            <Modal show={show} centered animation onHide={() => reset()}>
                <Modal.Header closeButton={error !== undefined}>Generating guardian key</Modal.Header>
                <Modal.Body>
                    <ul className="generate__steps">
                        <Step step={GenerateStep.Generate} activeStep={step} error={error}>
                            Generating guardian key pair
                        </Step>
                        <Step
                            step={GenerateStep.ApproveTransaction}
                            activeStep={step}
                            error={error}
                            note={energy ? `Transaction fee energy: ${energy.value.toString()} NRG` : ``} // TODO: calculate as CCD
                        >
                            Awaiting transaction approval
                            <div className="generate__step-note text-muted"></div>
                        </Step>
                        <Step step={GenerateStep.UpdateConctract} activeStep={step} error={error}>
                            Updating election contract
                        </Step>
                    </ul>
                </Modal.Body>
                {step === GenerateStep.ApproveTransaction && error === undefined && (
                    <Modal.Footer className="justify-content-start">
                        <Button onClick={acceptTransactionProposal} variant="secondary">
                            Send key registration
                        </Button>
                        <Button variant="danger" onClick={cancel}>
                            Cancel
                        </Button>
                    </Modal.Footer>
                )}
            </Modal>
        </>
    );
}

type AwaitPeerKeysProps = {
    guardians: GuardiansState;
};

function AwaitPeerKeys({guardians}: AwaitPeerKeysProps) {
    const numWithKeys = useMemo(() => guardians.filter(([, g]) => g.hasPublicKey).length, [guardians]);
    const progress = useMemo(() => numWithKeys * (100 / guardians.length), [numWithKeys, guardians]);

    return (
        <div>
            <h3>Waiting for other guardians to register keys</h3>
            <ProgressBar now={progress} label={`${numWithKeys}/${guardians.length}`} />
        </div>
    );
}

function GenerateDecryptionShare() {
    return (
    <h2>Generate decryption share</h2>
    )
}

/**
 * Component which shows the relevant actions for the guardian during the election setup phase
 */
export default function SetupActions() {
    const electionStep = useAtomValue(electionStepAtom);
    const { guardians } = useAtomValue(guardiansStateAtom);

    if (electionStep?.phase !== ElectionPhase.Setup || guardians === undefined) {
        return null;
    }

    return (
        <>
            {electionStep.step === SetupStep.GenerateKey && <GenerateGuardianKey />}
            {electionStep.step === SetupStep.AwaitPeerKeys && <AwaitPeerKeys guardians={guardians} />}
            {electionStep.step === SetupStep.GenerateDecryptionShare && <GenerateDecryptionShare />}
        </>
    );
}
