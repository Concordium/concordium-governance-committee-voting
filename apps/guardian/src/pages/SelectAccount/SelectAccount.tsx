import { AccountAddress, Base58String } from '@concordium/web-sdk';
import { useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, Modal } from 'react-bootstrap';
import { FormProvider, SubmitHandler, useForm, useFormContext } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { accountShowShort } from 'shared/util';
import { MainLocationState } from '~/layouts/Main/Main';
import Button from '~/shared/Button';
import { WalletAccount, loadAccount } from '~/shared/ffi';
import { selectedAccountAtom, accountsAtom } from '~/shared/store';
import { routes } from '~/shell/router';

type PasswordPromptProps = {
    show: boolean;
    onHide(): void;
    onAccountLoad(walletAccount: WalletAccount): void;
};

type PasswordPromptForm = {
    password: string;
};

function PasswordPrompt({ show, onHide, onAccountLoad }: PasswordPromptProps) {
    const { getValues } = useFormContext<SelectAccountForm>();
    const { handleSubmit, register, watch, formState, trigger, reset } = useForm<PasswordPromptForm>();
    const [loadAccountError, setLoadAccountError] = useState<string>();
    const [loading, setLoading] = useState(false);

    const passwordValue = watch('password');
    useEffect(() => {
        setLoadAccountError(undefined);
    }, [passwordValue]);

    const close = useCallback(() => {
        reset();
        onHide();
    }, [reset, onHide]);

    const submit: SubmitHandler<PasswordPromptForm> = useCallback(
        async ({ password }) => {
            setLoading(true);
            try {
                const account = await loadAccount(AccountAddress.fromBase58(getValues().account), password);

                onAccountLoad(account);
                close();
            } catch (e) {
                setLoadAccountError((e as Error).message);
                void trigger('password', { shouldFocus: true });
            } finally {
                setLoading(false);
            }
        },
        [setLoadAccountError, close, onAccountLoad, getValues, trigger, setLoading],
    );

    return (
        <Modal show={show} centered animation onHide={close} size="sm">
            <Modal.Header closeButton></Modal.Header>
            <Modal.Body>
                <form
                    onSubmit={handleSubmit((values) => {
                        void submit(values);
                    })}
                >
                    <Form.Group controlId="password" className="mb-3">
                        <Form.Label>Password</Form.Label>
                        <Form.Control
                            type="password"
                            placeholder="Select password"
                            isInvalid={formState.errors.password !== undefined}
                            {...register('password', {
                                required: 'Password required',
                                validate: () => loadAccountError === undefined || loadAccountError,
                            })}
                            autoFocus
                        />
                        <Form.Control.Feedback type="invalid">
                            {formState.errors.password?.message}
                        </Form.Control.Feedback>
                    </Form.Group>
                    <Button variant="secondary" type="submit" loading={loading}>
                        Load account
                    </Button>
                </form>
            </Modal.Body>
        </Modal>
    );
}

type AccountOptionProps = {
    account: AccountAddress.Type;
};

function AccountOption({ account }: AccountOptionProps) {
    const showAccount = useMemo(() => accountShowShort(account), [account]);
    const { register } = useFormContext();
    return (
        <Form.Check
            className="account-option mb-2"
            type="radio"
            label={showAccount}
            id={`option-${account.address}`}
            value={account.address}
            {...register('account', { required: true })}
        />
    );
}

type SelectAccountForm = {
    account: Base58String;
};

export default function SelectAccount() {
    const accounts = useAtomValue(accountsAtom);
    const nav = useNavigate();
    const form = useForm<SelectAccountForm>();
    const { setValue, handleSubmit } = form;
    const [requestPassword, setRequestPassword] = useState(false);
    const [selectedAccount, setSelectedAccount] = useAtom(selectedAccountAtom);

    const submit = () => {
        setRequestPassword(true);
    };

    useEffect(() => {
        if (accounts?.length === 0) {
            nav(routes.importAccount.path);
        }
    }, [accounts, nav]);

    const hasAccounts = useMemo(() => accounts !== undefined && accounts.length !== 0, [accounts]);
    useEffect(() => {
        if (hasAccounts) {
            const initialAccount = selectedAccount?.address ?? accounts![0].address;
            setValue('account', initialAccount);
        }
    }, [hasAccounts, accounts, setValue, selectedAccount]);

    useEffect(() => {
        if (selectedAccount !== undefined) {
            nav(routes.actions.path);
        }
    }, [selectedAccount, nav]);

    if (accounts === undefined) {
        return null;
    }

    return (
        <FormProvider {...form}>
            <form noValidate onSubmit={handleSubmit(submit)} className="col-12 select-account">
                {accounts?.map((account) => <AccountOption key={account.address} account={account} />)}
                <div>
                    <Button variant="primary" type="submit" className="me-4">
                        Select
                    </Button>
                    <Link to={routes.importAccount.path} state={{ canBack: true } as MainLocationState}>
                        Import new
                    </Link>
                </div>
            </form>
            <PasswordPrompt
                show={requestPassword}
                onHide={() => setRequestPassword(false)}
                onAccountLoad={setSelectedAccount}
            />
        </FormProvider>
    );
}
