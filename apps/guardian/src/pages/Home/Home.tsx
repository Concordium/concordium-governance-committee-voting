import { WalletExportFormat, parseWallet } from '@concordium/web-sdk';
import { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { Buffer } from 'buffer/';
import { invoke } from '@tauri-apps/api/tauri';

import FileInput from '~/shared/FileInput';
import { FileInputValue } from '~/shared/FileInput/FileInput';
import { useAsyncMemo } from 'shared/util';

// Attempts to parse/validate the given (encrypted) data.
async function processFile(file: File): Promise<WalletExportFormat> {
    const rawData = Buffer.from(await file.arrayBuffer());
    return parseWallet(rawData.toString('utf-8'));
}

function App() {
    const [fileInput, setFileInput] = useState<FileInputValue>(null);
    const [error, setError] = useState<string>();
    const walletExport = useAsyncMemo(
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
        if (walletExport !== undefined) {
            void invoke('import_wallet_account', { walletAccount: walletExport }).then(() => console.log('success'));
        }
    }, [walletExport]);

    console.log(walletExport);

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

export default App;
