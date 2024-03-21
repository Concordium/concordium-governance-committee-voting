import { Container, Nav, Navbar } from 'react-bootstrap';
import { Outlet, NavLink } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { clsx } from 'clsx';

import { connectionViewAtom, electionConfigAtom } from '~/shared/store';
import { WalletConnection } from './WalletConnection';
import { commonDateTimeFormat } from '~/shared/util';
import { ElectionOpenState, useIsElectionOpen } from '~/shared/hooks';
import pkg from '../../../package.json';
import { getDelegationRoute, routes } from '../router';

const showDate = (date: Date) => date.toLocaleString(undefined, commonDateTimeFormat);

/**
 * The application root layout.
 */
function App() {
    const electionConfig = useAtomValue(electionConfigAtom);
    const toggleAccount = useAtomValue(connectionViewAtom);
    const openState = useIsElectionOpen();

    return (
        <div className="flex-fill d-flex flex-column justify-content-between app">
            <div>
                <Navbar className="justify-content-between my-2 mb-md-4" expand="md">
                    <Container fluid="xxl">
                        {electionConfig === undefined && <div />}
                        {electionConfig !== undefined && (
                            <>
                                <Navbar.Brand as={NavLink} to={routes.home.path}>
                                    {electionConfig.description}
                                    <div
                                        className={clsx(
                                            'fs-6 app__nav-phase',
                                            openState === ElectionOpenState.Open ? 'text-success' : 'text-muted',
                                        )}
                                    >
                                        {openState === ElectionOpenState.NotStarted &&
                                            `Opening at ${showDate(electionConfig.start)}`}
                                        {openState === ElectionOpenState.SetupError && 'Voting window to be determined'}
                                        {openState === ElectionOpenState.Open &&
                                            `Open until ${showDate(electionConfig.end)}`}
                                        {openState === ElectionOpenState.Concluded &&
                                            `Closed at ${showDate(electionConfig.end)}`}
                                    </div>
                                </Navbar.Brand>
                                <div className="app__nav-actions">
                                    <WalletConnection />
                                    <Navbar.Toggle aria-controls="basic-navbar-nav" className="ms-2" />
                                </div>
                                <Navbar.Collapse id="basic-navbar-nav">
                                    <Nav>
                                        <Nav.Link as={NavLink} to={getDelegationRoute()}>
                                            Delegations
                                        </Nav.Link>
                                        <Nav.Link as={'div'} role="button" onClick={() => toggleAccount?.()}>
                                            Submissions
                                        </Nav.Link>
                                    </Nav>
                                </Navbar.Collapse>
                            </>
                        )}
                    </Container>
                </Navbar>
                <Container as="main">
                    <Outlet />
                </Container>
            </div>
            <Container as="footer" className="app__footer mb-3">
                <div>Version: {pkg.version}</div>
            </Container>
        </div>
    );
}

export default App;
