import { AccountAddress, WalletExportFormat, parseWallet } from '@concordium/web-sdk';
import { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { Buffer } from 'buffer/';
import { invoke } from '@tauri-apps/api/tauri';

import FileInput from '~/shared/FileInput';
import { FileInputValue } from '~/shared/FileInput/FileInput';
import { useAsyncMemo } from 'shared/util';
import { useSetAtom } from 'jotai';
import { accountAtom } from '~/shared/store';

/**
 * Attempts to parse/validate the data as {@linkcode WalletExportFormat}.
 */
async function processFile(file: File): Promise<WalletExportFormat> {
    const rawData = Buffer.from(await file.arrayBuffer());
    return parseWallet(rawData.toString('utf-8'));
}

function LoadWalletAccount() {
    const [fileInput, setFileInput] = useState<FileInputValue>(null);
    const [error, setError] = useState<string>();
    const setAccount = useSetAtom(accountAtom);

    const walletAccount = useAsyncMemo(
        async () => {
            setError(undefined);
            if (fileInput !== null) {
                return processFile(fileInput[0]);
            }
        },
        () => setError('File is not a valid wallet export'),
        [fileInput],
    );

    useEffect(() => {
        if (walletAccount !== undefined) {
            void invoke('import_wallet_account', { walletAccount }).then(() =>
                setAccount(AccountAddress.fromBase58(walletAccount.value.address)),
            );
        }
    }, [walletAccount, setAccount]);

    console.log(walletAccount);

    return (
        <Container fluid>
            <FileInput
                placeholder="Drop Concordium Wallet export here"
                buttonTitle="or click to browse"
                onChange={setFileInput}
                error={error}
                value={fileInput}
            />
        </Container>
    );
}

export default LoadWalletAccount;
