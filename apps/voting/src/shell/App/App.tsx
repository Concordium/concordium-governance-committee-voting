import { Container } from 'react-bootstrap';
import { useAtomValue } from 'jotai';

import { electionConfigAtom } from '~/shared/store';
import Home from '~/pages/Home';
import { WalletConnection } from './WalletConnection';
import { commonDateTimeFormat } from '~/shared/util';
import { ElectionOpenState, useIsElectionOpen } from '~/shared/hooks';

import pkg from '../../../package.json';

const showDate = (date: Date) => date.toLocaleString(undefined, commonDateTimeFormat);

/**
 * The application root layout.
 */
function App() {
    const electionConfig = useAtomValue(electionConfigAtom);
    const openState = useIsElectionOpen();

    return (
        <Container className="flex-fill d-flex flex-column justify-content-between">
            <div>
                <header className="d-flex flex-wrap justify-content-between mb-4 mt-5">
                    {electionConfig !== undefined && (
                        <div className="mb-2">
                            <h2 className="mb-0">{electionConfig.description}</h2>
                            <div className={openState === ElectionOpenState.Open ? 'text-success' : 'text-danger'}>
                                {openState === ElectionOpenState.Open && `Open until ${showDate(electionConfig.end)}`}
                                {openState === ElectionOpenState.NotStarted &&
                                    `Opening at ${showDate(electionConfig.start)}`}
                                {openState === ElectionOpenState.Concluded &&
                                    `Closed at ${showDate(electionConfig.end)}`}
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
            </div>
            <footer className="app__footer mb-3">
                <div>Version: {pkg.version}</div>
            </footer>
        </Container>
    );
}

export default App;
