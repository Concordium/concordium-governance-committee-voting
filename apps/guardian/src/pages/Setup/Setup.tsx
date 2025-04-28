import { ContractAddress } from '@concordium/web-sdk';
import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { FormProvider, SubmitHandler, Validate, useForm } from 'react-hook-form';
import Button from '~/shared/Button';
import { setElectionTarget, validateElectionTarget } from '~/shared/ffi';
import { electionConfigAtom } from '~/shared/store';

const validateIsElection: Validate<SetupForm['contractIndex'], SetupForm> = async (value, form) => {
    const contract = ContractAddress.create(BigInt(value));
    try {
        await validateElectionTarget(form.network, contract);
    } catch (e: unknown) {
        return (e as Error).message;
    }
    return true;
};

const validateIsInteger: Validate<SetupForm['contractIndex'], SetupForm> = (value) => {
    const parsedValue = Number(value);
    return Number.isInteger(parsedValue) || 'Contract index must be an integer';
};

type SetupForm = {
    /** The network of the target election contract */
    network: TargetNetwork;
    /** The contract index of the target election contract */
    contractIndex: string;
};

/**
 * Component which enables the user to setup the application to target a specific election.
 */
export default function Setup() {
    const [electionConfig, setElectionConfig] = useAtom(electionConfigAtom);
    const form = useForm<SetupForm>({
        defaultValues: {
            network: electionConfig?.network ?? 'mainnet',
            contractIndex: electionConfig?.contractAddress.index.toString(),
        },
    });
    const {
        handleSubmit,
        formState: { errors, isSubmitted },
        watch,
        trigger,
    } = form;

    const network = watch('network');

    useEffect(() => {
        if (isSubmitted) {
            void trigger('contractIndex');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [network]);

    const submit: SubmitHandler<SetupForm> = useCallback(
        async (data: SetupForm) => {
            const { network, contractIndex } = data;
            const config = await setElectionTarget(network, ContractAddress.create(BigInt(contractIndex)));
            void setElectionConfig(config);
        },
        [setElectionConfig],
    );

    return (
        <div className="setup">
            <h1 className="mb-4">Election target configuration</h1>
            <div className="setup__form">
                <FormProvider {...form}>
                    <form noValidate onSubmit={handleSubmit(submit)}>
                        <Form.Group className="mb-3">
                            <Form.Label>Network</Form.Label>
                            <Form.Select
                                isInvalid={errors.network !== undefined}
                                {...form.register('network', { required: 'Target network must be specified' })}
                            >
                                <option value="mainnet">Mainnet</option>
                                <option value="testnet">Testnet</option>
                            </Form.Select>
                            <Form.Control.Feedback type="invalid">{errors.network?.message}</Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Contract index</Form.Label>
                            <Form.Control
                                type="number"
                                isInvalid={errors.contractIndex !== undefined}
                                isValid={errors.contractIndex === undefined && isSubmitted}
                                {...form.register('contractIndex', {
                                    required: 'Target contract index must be specified',
                                    min: { value: 0, message: 'Contract index must be a positive number' },
                                    validate: {
                                        integer: validateIsInteger,
                                        isElectionContract: validateIsElection,
                                    },
                                })}
                                min={0}
                            />
                            <Form.Control.Feedback type="invalid">
                                {errors.contractIndex?.message}
                            </Form.Control.Feedback>
                        </Form.Group>
                        <Button type="submit">Connect</Button>
                    </form>
                </FormProvider>
            </div>
        </div>
    );
}
