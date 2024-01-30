import { AccountAddress, WalletExportFormat, parseWallet } from '@concordium/web-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, Modal } from 'react-bootstrap';
import { Buffer } from 'buffer/';
import { useAtomValue, useSetAtom } from 'jotai';
import { useForm, Validate } from 'react-hook-form';

import FileInput from '~/shared/FileInput';
import { FileInputValue } from '~/shared/FileInput/FileInput';
import { useAsyncMemo } from 'shared/util';
import { guardiansStateAtom, selectedAccountAtom } from '~/shared/store';
import { importWalletAccount } from '~/shared/ffi';
import { useNavigate } from 'react-router-dom';
import { routes } from '~/shell/router';
import Button from '~/shared/Button';

type PasswordModalProps = {
    /** Whether to show the modal */
    show: boolean;
    /** Callback triggered when modal should hide, i.e. this should consequently set `show` to false */
    onHide(): void;
    /** Callback triggered when form is submitted */
    onSubmit(password: string): void;
};

type PasswordForm = {
    /** The password of the form */
    password: string;
    /** The repeated password, used for validating `password` */
    repeated: string;
};

/**
 * A modal component for getting a password from user input.
 */
function PasswordModal({ onSubmit, show, onHide }: PasswordModalProps) {
    const {
        formState: { errors },
        register,
        handleSubmit,
        reset,
    } = useForm<PasswordForm>({ mode: 'onTouched' });

    /**
     * Closes the modal
     */
    const close = useCallback(() => {
        reset();
        onHide();
    }, [reset, onHide]);

    /**
     * Submit handler for the form
     */
    const submit = useCallback(
        ({ password }: PasswordForm) => {
            onSubmit(password);
            close();
        },
        [onSubmit, close],
    );

    /**
     * Validates that the passwords given match.
     */
    const validateRepeated: Validate<string, PasswordForm> = useCallback((value, formValues) => {
        return value === formValues.password || 'Password mismatch';
    }, []);

    return (
        <Modal show={show} size="sm" centered onHide={close} animation>
            <Modal.Header closeButton>Please select a password</Modal.Header>
            <Modal.Body>
                <Form noValidate onSubmit={handleSubmit(submit)}>
                    <Form.Group controlId="password">
                        <Form.Label>Password</Form.Label>
                        <Form.Control
                            type="password"
                            placeholder="Select password"
                            {...register('password', { required: 'Field required' })}
                            isInvalid={errors.password !== undefined}
                            autoFocus
                        />
                        <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group controlId="repeated" className="mt-3">
                        <Form.Label>Repeat password</Form.Label>
                        <Form.Control
                            type="password"
                            placeholder="Repeat password"
                            {...register('repeated', { required: 'Field required', validate: validateRepeated })}
                            isInvalid={errors.repeated !== undefined}
                        />
                        <Form.Control.Feedback type="invalid">{errors.repeated?.message}</Form.Control.Feedback>
                    </Form.Group>
                    <Button type="submit" className="mt-3">
                        Submit
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
}

/**
 * Attempts to parse/validate the data as {@linkcode WalletExportFormat}.
 */
async function processFile(file: File): Promise<WalletExportFormat> {
    const rawData = Buffer.from(await file.arrayBuffer());
    return parseWallet(rawData.toString('utf-8'));
}

/**
 * A component enabling users to import a wallet export into the application.
 */
export default function ImportWalletAccount() {
    const [fileInput, setFileInput] = useState<FileInputValue>(null);
    const [error, setError] = useState<string>();
    const setAccount = useSetAtom(selectedAccountAtom);
    const [password, setPassword] = useState<string>();
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const guardiansState = useAtomValue(guardiansStateAtom);
    const guardians = useMemo(
        () => guardiansState.guardians?.map(([account]) => AccountAddress.toBase58(account)),
        [guardiansState],
    );
    const nav = useNavigate();

    const guardianData = useAsyncMemo(
        async () => {
            setError(undefined);
            if (fileInput === null || guardians === undefined) {
                return undefined;
            }

            const contents = await processFile(fileInput[0]);
            const index = guardians.findIndex((address) => contents.value.address === address);
            if (index !== -1) {
                return { walletExport: contents, index: index + 1 };
            }

            setError('Imported account is not a guardian in the election');
        },
        () => setError('File is not a valid wallet export'),
        [fileInput, guardians],
    );

    useEffect(() => {
        if (guardianData !== undefined) {
            setShowModal(true);
        }
    }, [guardianData]);

    useEffect(() => {
        if (guardianData !== undefined && password !== undefined) {
            setLoading(true);

            void importWalletAccount(guardianData.walletExport, guardianData.index, password)
                .then((imported) => {
                    setAccount(imported);
                    nav(routes.actions.path);
                })
                .catch((e: Error) => {
                    setError(e.message);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [guardianData, password, setAccount, nav]);

    return (
        <>
            <FileInput
                placeholder="Drop Concordium Wallet export here"
                buttonTitle="or click to browse"
                onChange={setFileInput}
                error={error}
                value={fileInput}
                className="col-16 import"
                loading={loading}
            />
            <PasswordModal show={showModal} onSubmit={setPassword} onHide={() => setShowModal(false)} />
        </>
    );
}
