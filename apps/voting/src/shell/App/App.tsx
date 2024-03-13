import { Container, Nav, Navbar } from 'react-bootstrap';
import { useAtomValue } from 'jotai';
import { clsx } from 'clsx';

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
        <div className="flex-fill d-flex flex-column justify-content-between">
            <div>
                <Navbar className="justify-content-between my-2 mb-md-4" expand="md">
                    <Container>
                        {electionConfig !== undefined && (
                            <>
                                <Navbar.Brand href="#home">
                                    {electionConfig.description}
                                    <div
                                        className={clsx(
                                            'fs-6 app__nav-phase',
                                            openState === ElectionOpenState.Open ? 'text-success' : 'text-danger',
                                        )}
                                    >
                                        {openState === ElectionOpenState.Open &&
                                            `Open until ${showDate(electionConfig.end)}`}
                                        {openState === ElectionOpenState.NotStarted &&
                                            `Opening at ${showDate(electionConfig.start)}`}
                                        {openState === ElectionOpenState.Concluded &&
                                            `Closed at ${showDate(electionConfig.end)}`}
                                    </div>
                                </Navbar.Brand>
                                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                                <Navbar.Collapse id="basic-navbar-nav">
                                    <Nav>
                                        <Nav.Link href="#delegation">Delegation</Nav.Link>
                                    </Nav>
                                </Navbar.Collapse>
                            </>
                        )}
                        <WalletConnection />
                    </Container>
                </Navbar>
                <Container as="main">
                    <Home />
                </Container>
            </div>
            <Container as="footer" className="app__footer mb-3">
                <div>Version: {pkg.version}</div>
            </Container>
        </div>
    );
}

export default App;
