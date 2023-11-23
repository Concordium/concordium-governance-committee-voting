import { Container } from 'react-bootstrap';
import { useAtomValue } from 'jotai';
import { electionConfigAtom } from '@shared/store';
import { Timestamp } from '@concordium/web-sdk';

import Home from '@pages/Home';
import { WalletConnection } from './WalletConnection';

const dateFormat: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
};

function App() {
    const electionConfig = useAtomValue(electionConfigAtom);
    return (
        <Container className="mt-4">
            <header className="d-flex flex-wrap justify-content-between mb-4">
                {electionConfig !== undefined && (
                    <div className="mb-2">
                        <h2 className='mb-0'>{electionConfig.election_description}</h2>
                        <div>
                            {Timestamp.toDate(electionConfig.election_start).toLocaleString(undefined, dateFormat)} -{' '}
                            {Timestamp.toDate(electionConfig.election_end).toLocaleString(undefined, dateFormat)}
                        </div>
                    </div>
                )}
                <div className="mb-2">
                    <WalletConnection />
                </div>
            </header>
            <main>
                <Home />
            </main>
        </Container>
    );
}

export default App;
