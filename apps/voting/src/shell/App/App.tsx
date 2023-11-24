import { Container } from 'react-bootstrap';
import { useAtomValue } from 'jotai';

import { electionConfigAtom } from '@shared/store';
import Home from '@pages/Home';
import { WalletConnection } from './WalletConnection';
import { commonDateTimeFormat } from '@shared/util';


function App() {
    const electionConfig = useAtomValue(electionConfigAtom);
    return (
        <Container>
            <header className="d-flex flex-wrap justify-content-between mb-4">
                {electionConfig !== undefined && (
                    <div className="mb-2">
                        <h2 className="mb-0">{electionConfig.election_description}</h2>
                        <div>
                            {electionConfig.start.toLocaleString(undefined, commonDateTimeFormat)} -{' '}
                            {electionConfig.end.toLocaleString(undefined, commonDateTimeFormat)}
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
