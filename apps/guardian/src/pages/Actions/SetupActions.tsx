import { clsx } from 'clsx';
import {
    type ComponentType,
    FunctionComponent,
    PropsWithChildren,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Modal, ProgressBar, Spinner } from 'react-bootstrap';
import { useAtomValue, useSetAtom } from 'jotai';
import { CcdAmount } from '@concordium/web-sdk';

import Button from '~/shared/Button';
import SuccessIcon from '~/assets/rounded-success.svg?react';
import ErrorIcon from '~/assets/rounded-warning.svg?react';
import {
    BackendError,
    GuardianStatus,
    GuardiansState,
    ValidatedProposalType,
    generateSecretShare,
    registerGuardianKey,
    registerGuardianShares,
} from '~/shared/ffi';
import { CCD_SYMBOL, sleep, useCountdown } from 'shared/util';
import { ElectionPhase, SetupStep, electionConfigAtom, electionStepAtom, guardiansStateAtom } from '~/shared/store';

const enum ActionStep {
    Generate,
    ApproveTransaction,
    UpdateConctract,
    Done,
}

type StepProps = PropsWithChildren<{
    activeStep: ActionStep;
    step: ActionStep;
    error?: string;
    note?: string;
    warn?: boolean;
}>;

const enum StepStatus {
    Inactive,
    Active,
    Success,
    Error,
}

function Step({ step, activeStep, error, children, note, warn = false }: StepProps) {
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
        <li className={clsx('generate__step', warn && 'generate__step--warn')}>
            <div className="generate__step-icon">
                {!warn && status === StepStatus.Active && <Spinner animation="border" size="sm" />}
                {(warn || status === StepStatus.Error) && <ErrorIcon width="20" />}
                {!warn && status === StepStatus.Success && <SuccessIcon width="20" />}
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
 * Creates an {@linkcode AbortController} which aborts when the component using the hook unmounts.
 * This wraps a react `RefObject`, so it will never trigger any component updates.
 */
function useInteractionFlow<P>(interactionFlow: (abortSignal: AbortSignal) => AsyncGenerator<P, void, boolean>) {
    const abortControllerRef = useRef(new AbortController());
    const flowRef = useRef<ReturnType<typeof interactionFlow>>(interactionFlow(abortControllerRef.current.signal));

    /**
     * Triggers abort on the current abort signal and creates a new {@linkcode AbortController}.
     */
    const abort = useCallback(() => {
        abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        flowRef.current = interactionFlow(abortControllerRef.current.signal);
    }, [interactionFlow]);

    /**
     * Invokes next on the underlying generator function of the interaction flow.
     */
    const next = useCallback((...args: Parameters<typeof flowRef.current.next>) => flowRef.current.next(...args), []);

    return useMemo(() => ({ abort, next }), [abort, next]);
}

type ActionableStepsChildProps<P> = {
    step: ActionStep;
    proposal: P | undefined;
    error: string | undefined;
    isOpen: boolean;
    initFlow(): void;
    acceptProposal(): void;
    rejectProposal(): void;
    hide(): void;
};

function makeActionableStep<P>(
    interactionFlow: (abortSignal: AbortSignal) => AsyncGenerator<P, void, boolean>,
    Component: ComponentType<ActionableStepsChildProps<P>>,
): FunctionComponent {
    return function ActionableStep() {
        const [isOpen, setIsOpen] = useState(false);
        const [error, setError] = useState<string>();
        const [step, setStep] = useState<ActionStep>(ActionStep.Generate);
        const [proposal, setProposal] = useState<P>();
        const flow = useInteractionFlow(interactionFlow);
        const refreshGuardians = useSetAtom(guardiansStateAtom);

        /**
         * Reset the component to its initial state, and aborts any ongoing interaction with the backend
         */
        const reset = useCallback(() => {
            setIsOpen(false);
            setProposal(undefined);
            setError(undefined);
            setStep(ActionStep.Generate);
            flow.abort();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        /**
         * Sends the contract update by accepting the proposed transaction
         */
        const acceptProposal = useCallback(() => {
            if (flow === undefined) {
                throw new Error('Expected interaction generator to still be available');
            }

            setStep(ActionStep.UpdateConctract);
            flow.next(true)
                .then(() => {
                    setStep(ActionStep.Done);
                    return sleep(1000); // Allow user to see the successful contract update step
                })
                .then(refreshGuardians)
                .then(reset)
                .catch((e: BackendError) => {
                    setError(e.message);
                });
        }, [flow, reset, refreshGuardians]);

        /**
         * Reject the proposed transaction.
         */
        const rejectProposal = useCallback(() => {
            if (flow === undefined) {
                throw new Error('Expected interaction generator to still be available');
            }

            void flow.next(false);
            reset();
        }, [flow, reset]);

        // Runs when modal shows
        useEffect(() => {
            if (isOpen && flow !== undefined) {
                flow.next()
                    .then((res) => {
                        setProposal(res.value as P);
                        setStep(ActionStep.ApproveTransaction);
                    })
                    .catch((e: BackendError) => {
                        setError(e.message);
                    });
            }
        }, [isOpen, flow]);

        // Clean up on unmount
        useEffect(
            () => () => {
                reset();
            },
            [reset],
        );

        const props: ActionableStepsChildProps<P> = useMemo(
            () => ({
                step,
                proposal,
                error,
                initFlow: () => setIsOpen(true),
                hide: reset,
                acceptProposal,
                rejectProposal,
                isOpen,
            }),
            [acceptProposal, error, proposal, rejectProposal, isOpen, step, reset],
        );

        return <Component {...props} />;
    };
}

const GenerateGuardianKey = makeActionableStep(
    registerGuardianKey,
    ({ initFlow, proposal, error, step, acceptProposal, rejectProposal, isOpen, hide }) => (
        <>
            <Button onClick={initFlow} disabled={isOpen} size="lg">
                Generate guardian key
            </Button>
            <Modal show={isOpen} centered animation onHide={hide} backdrop="static" keyboard={false}>
                <Modal.Header closeButton={error !== undefined}>Generating guardian key</Modal.Header>
                <Modal.Body>
                    <ul className="generate__steps">
                        <Step step={ActionStep.Generate} activeStep={step} error={error}>
                            Generating guardian key pair
                        </Step>
                        <Step
                            step={ActionStep.ApproveTransaction}
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
                            Updating election contract
                        </Step>
                    </ul>
                </Modal.Body>
                {step === ActionStep.ApproveTransaction && error === undefined && (
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

type GuardiansProps = {
    guardians: GuardiansState;
};

/**
 * Shows the progress of key registrations for guardians.
 */
function AwaitPeerKeys({ guardians }: GuardiansProps) {
    const numWithKeys = useMemo(() => guardians.filter(([, g]) => g.hasPublicKey).length, [guardians]);
    const progress = useMemo(() => numWithKeys * (100 / guardians.length), [numWithKeys, guardians]);

    return (
        <div>
            <h3 className="text-center">Waiting for other guardians to register their keys</h3>
            <ProgressBar now={progress} label={`${numWithKeys}/${guardians.length}`} />
        </div>
    );
}

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
                    Generate decryption share
                </Button>
                <Modal show={isOpen} centered animation onHide={hide} backdrop="static" keyboard={false}>
                    <Modal.Header closeButton={error !== undefined}>Generating encrypted shares</Modal.Header>
                    <Modal.Body>
                        <ul className="generate__steps">
                            <Step
                                step={ActionStep.Generate}
                                activeStep={step}
                                error={error}
                                warn={peerValidationMessage !== undefined}
                                note={peerValidationMessage}
                            >
                                Generating encrypted shares
                            </Step>
                            <Step
                                step={ActionStep.ApproveTransaction}
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
                                Updating election contract
                            </Step>
                        </ul>
                    </Modal.Body>
                    {step === ActionStep.ApproveTransaction && error === undefined && (
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
 * Shows the progress of encrypted shares registrations for guardians.
 */
function AwaitPeerShares({ guardians }: GuardiansProps) {
    const numWithShares = useMemo(() => guardians.filter(([, g]) => g.hasEncryptedShares).length, [guardians]);
    const progress = useMemo(() => numWithShares * (100 / guardians.length), [numWithShares, guardians]);

    return (
        <div>
            <h3 className="text-center">Waiting for other guardians to register their encrypted shares</h3>
            <ProgressBar now={progress} label={`${numWithShares}/${guardians.length}`} />
        </div>
    );
}

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
                    Generate secret share
                </Button>
                <Modal show={isOpen} centered animation onHide={hide} backdrop="static" keyboard={false}>
                    <Modal.Header closeButton={error !== undefined}>Generating secret share</Modal.Header>
                    <Modal.Body>
                        <ul className="generate__steps">
                            <Step
                                step={ActionStep.Generate}
                                activeStep={step}
                                error={error}
                                warn={peerValidationMessage !== undefined}
                                note={peerValidationMessage}
                            >
                                Generating secret share
                            </Step>
                            <Step
                                step={ActionStep.ApproveTransaction}
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
                                Updating election contract
                            </Step>
                        </ul>
                    </Modal.Body>
                    {step === ActionStep.ApproveTransaction && error === undefined && (
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
 * Shows the progress of encrypted shares validation and secret key generation for guardians.
 */
function AwaitPeerValidation({ guardians }: GuardiansProps) {
    const numValidations = useMemo(
        () => guardians.filter(([, g]) => g.status === GuardianStatus.VerificationSuccessful).length,
        [guardians],
    );
    const progress = useMemo(() => numValidations * (100 / guardians.length), [numValidations, guardians]);

    return (
        <div>
            <h3 className="text-center">Waiting for other guardians to generate their secret share</h3>
            <ProgressBar now={progress} label={`${numValidations}/${guardians.length}`} />
        </div>
    );
}

function Ready() {
    const electionConfig = useAtomValue(electionConfigAtom);
    const countdown = useCountdown(electionConfig!.electionStart); // Reasonable unwrap, as this is checked in the parent component.

    return (
        <>
            <h1>Election setup complete</h1>
            <p>
                Election begins in <br />
                <b className="text-primary">{countdown}</b>
            </p>
        </>
    );
}

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
 * Component which shows the relevant actions for the guardian during the election setup phase
 */
export default function SetupActions() {
    const electionStep = useAtomValue(electionStepAtom);
    const { guardians } = useAtomValue(guardiansStateAtom);

    if (electionStep?.phase !== ElectionPhase.Setup || guardians === undefined) {
        return null;
    }

    return (
        <div className="text-center">
            {electionStep.step === SetupStep.GenerateKey && <GenerateGuardianKey />}
            {electionStep.step === SetupStep.AwaitPeerKeys && <AwaitPeerKeys guardians={guardians} />}
            {electionStep.step === SetupStep.GenerateEncryptedShares && <GenerateEncryptedShares />}
            {electionStep.step === SetupStep.AwaitPeerShares && <AwaitPeerShares guardians={guardians} />}
            {electionStep.step === SetupStep.GenerateSecretShare && <GenerateSecretShare />}
            {electionStep.step === SetupStep.AwaitPeerValidation && <AwaitPeerValidation guardians={guardians} />}
            {electionStep.step === SetupStep.Done && <Ready />}
            {electionStep.step === SetupStep.Invalid && <Invalid />}
        </div>
    );
}
