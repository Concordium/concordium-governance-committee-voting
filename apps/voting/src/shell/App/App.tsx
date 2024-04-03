import { Container, Nav, Navbar } from 'react-bootstrap';
import { Outlet, NavLink } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { clsx } from 'clsx';

import { connectionViewAtom, electionConfigAtom } from '~/shared/store';
import { WalletConnection } from './WalletConnection';
import { commonDateTimeFormat } from '~/shared/util';
import { ElectionOpenState, useIsElectionOpen } from '~/shared/hooks';
import { getDelegationRoute, routes } from '../router';
import Logo from '~/assets/logo-checkmark.svg?react';

import pkg from '../../../package.json';

const showDate = (date: Date) => date.toLocaleString(undefined, commonDateTimeFormat);

/**
 * The application root layout.
 */
function App() {
    const electionConfig = useAtomValue(electionConfigAtom);
    const toggleAccount = useAtomValue(connectionViewAtom);
    const openState = useIsElectionOpen();

    const open = electionConfig !== undefined && (
        <div className={clsx(openState === ElectionOpenState.Open ? 'text-success' : 'text-muted')}>
            {openState === ElectionOpenState.NotStarted && `Opening at ${showDate(electionConfig.start)}`}
            {openState === ElectionOpenState.SetupError && 'Voting window to be determined'}
            {openState === ElectionOpenState.Open && `Open until ${showDate(electionConfig.end)}`}
            {openState === ElectionOpenState.Concluded && `Closed at ${showDate(electionConfig.end)}`}
        </div>
    );

    return (
        <div className="flex-fill d-flex flex-column justify-content-between app">
            <div>
                <Navbar className="justify-content-between my-2 mb-md-4" expand="md">
                    <Container fluid="xxl">
                        <>
                            <Navbar.Brand as={NavLink} to={routes.home.path}>
                                <div className="d-flex align-items-center">
                                    <Logo width={40} className="me-2" />
                                    <span className="d-none d-sm-inline">{electionConfig?.description ?? ''}</span>
                                </div>
                                <span className="d-none d-md-block fs-6 position-absolute left-6">{open}</span>
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
                    </Container>
                </Navbar>
                <Container as="main">
                    <div className="text-center">
                        <h3 className="d-sm-none mb-0">{electionConfig?.description ?? ''}</h3>
                        <div className="d-md-none fs-5 mb-3">{open}</div>
                    </div>
                    <Outlet />
                </Container>
            </div>
            <Container as="footer" className="app__footer mb-3">
                <span>Version: {pkg.version}</span>
                <a
                    target="_blank"
                    href="https://developer.concordium.software/en/mainnet/net/voting/gc-voting.html"
                    rel="noreferrer"
                >
                    Documentation
                </a>
            </Container>
        </div>
    );
}

export default App;
