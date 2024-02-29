import { clsx } from 'clsx';
import { useAtomValue, useSetAtom } from 'jotai';
import {
    PropsWithChildren,
    useMemo,
    useRef,
    useCallback,
    ComponentType,
    FunctionComponent,
    useState,
    useEffect,
} from 'react';
import { ProgressBar, Spinner } from 'react-bootstrap';
import { sleep } from 'shared/util';

import { BackendError, GuardianState, GuardiansState } from '~/shared/ffi';
import { guardiansStateAtom } from '~/shared/store';
import SuccessIcon from '~/assets/rounded-success.svg?react';
import ErrorIcon from '~/assets/rounded-warning.svg?react';

/**
 * The steps run for each guardian action performed.
 */
export const enum ActionStep {
    /** Compute the value (e.g. guardian key) required for the action to succeed. */
    Compute,
    /** Handle the proposal from the backend. */
    HandleProposal,
    /** Update the contract according to the proposal. */
    UpdateConctract,
    /** Completed all steps of action. */
    Done,
}

/**
 * The props for {@linkcode Step}
 */
export type StepProps = PropsWithChildren<{
    /** The active step in the action flow. */
    activeStep: ActionStep;
    /** The action flow step to represent. */
    step: ActionStep;
    /** An optional error message. */
    error?: string;
    /** An optional note to show (e.g. cost of proposed transaction). */
    note?: string;
    /**
     * Whether the step should render as a warning instead of successful. This should be the case if the proposed
     * transaction signals detection of invalid submissions.
     */
    warn?: boolean;
}>;

/**
 * The status of an action flow step. This will be derived from the {@linkcode StepProps} supplied to the {@linkcode
 * Step} component.
 */
const enum StepStatus {
    /** The step is inactive, i.e. any previous step is being executed. */
    Inactive,
    /** The step is being executed. */
    Active,
    /** The step was successfully executed. */
    Success,
    /** An error occured while executing the step. */
    Error,
    /** Step was successfully executed, but produced a value which should be shown as a warning. */
    Warn,
}

export function Step({ step, activeStep, error, children, note, warn = false }: StepProps) {
    const ownError = step === activeStep ? error : undefined;
    const status = useMemo(() => {
        if (step > activeStep) {
            return StepStatus.Inactive;
        }
        if (step < activeStep) {
            return warn ? StepStatus.Warn : StepStatus.Success;
        }

        return ownError !== undefined ? StepStatus.Error : StepStatus.Active;
    }, [ownError, step, activeStep, warn]);

    return (
        <li className={clsx('generate__step', status === StepStatus.Warn && 'generate__step--warn')}>
            <div className="generate__step-icon">
                {status === StepStatus.Active && <Spinner animation="border" size="sm" />}
                {(status === StepStatus.Error || status === StepStatus.Warn) && <ErrorIcon width="20" />}
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

/**
 * HOC for making a component enabling the user to perform some actionable step corresponding to the `interactionFlow`
 * passed
 *
 * @template P - The type of the proposal received from the backend which requires user action
 *
 * @param interactionFlow - The flow to execute
 * @param Component - The component to render in the context of the flow
 * @returns A component enabling the user to perform the flow
 */
export function makeActionableStep<P>(
    interactionFlow: (abortSignal: AbortSignal) => AsyncGenerator<P, void, boolean>,
    Component: ComponentType<ActionableStepsChildProps<P>>,
): FunctionComponent {
    return function ActionableStep() {
        const [isOpen, setIsOpen] = useState(false);
        const [error, setError] = useState<string>();
        const [step, setStep] = useState<ActionStep>(ActionStep.Compute);
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
            setStep(ActionStep.Compute);
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
                        setStep(ActionStep.HandleProposal);
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

type AwaitPeersProps = PropsWithChildren<{
    /** The total amount of guardians awaiting submission from. Defaults to all guardians if not specified */
    guardians?: GuardiansState;
    /** Predicate for determing whether a guardian is done with step */
    predicate(g: GuardianState): boolean;
    /** An optional note to show below the progress bar */
    note?: string | JSX.Element;
}>;

/**
 * Shows the progress of peer registrations for a specific step in the election
 */
export function AwaitPeers(props: AwaitPeersProps) {
    const { guardians: defaultGuardians } = useAtomValue(guardiansStateAtom);
    const { predicate, children, note, guardians = defaultGuardians } = props;

    if (guardians === undefined) {
        return null;
    }

    const numRegistered = guardians.filter(([, g]) => predicate(g)).length;
    const progress = numRegistered * (100 / guardians.length);

    return (
        <div>
            <h3 className="text-center mb-3">{children}</h3>
            <ProgressBar now={progress} label={`${numRegistered}/${guardians.length}`} />
            {note && <p className="mt-3">{note}</p>}
        </div>
    );
}
