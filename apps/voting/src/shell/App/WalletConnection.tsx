import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';
import { Button, Offcanvas, ProgressBar, ProgressBarProps } from 'react-bootstrap';
import { useAtomValue, useSetAtom } from 'jotai';
import { RESET } from 'jotai/utils';
import { AccountAddress, TransactionHash } from '@concordium/web-sdk';
import { clsx } from 'clsx';

import { useBrowserWallet, useWalletConnect } from '~/shared/wallet-connection';
import WalletConnectIcon from '~/assets/walletconnect.svg';
import ConcordiumIcon from '~/assets/ccd.svg';
import {
    BallotSubmissionStatus,
    Wallet,
    activeWalletAtom,
    activeWalletVotingWeightAtom,
    connectionViewAtom,
    loadMoreSubmittedBallotsAtom,
    submittedBallotsAtom,
} from '~/shared/store';
import { commonDateTimeFormat } from '~/shared/util';
import { accountShowShort } from 'shared/util';
import { Link } from 'react-router-dom';
import { getDelegationRoute } from '../router';

/**
 * Button for connecting user through wallet connect compatible Concordium wallet.
 */
function ConnectWalletConnect() {
    const { isActive, isConnecting, connect: _connect } = useWalletConnect();

    const connect = () => {
        if (isActive || isConnecting) {
            return;
        }

        void _connect();
    };

    return (
        <button onClick={connect} className="clear connect-wallet__button">
            <img className="connect-wallet__button-icon" src={WalletConnectIcon} alt="wallet connect icon" />
            Concordium Mobile Wallet
        </button>
    );
}

/**
 * Button for connecting user through Concordium Wallet for Web.
 */
function ConnectBrowser() {
    const bw = useBrowserWallet();
    if (bw === undefined) {
        return null;
    }

    const { isActive, isConnecting, connect: _connect } = bw;

    const connect = () => {
        if (isActive || isConnecting) {
            return;
        }

        void _connect();
    };

    return (
        <button onClick={connect} className="clear connect-wallet__button">
            <img
                className="connect-wallet__button-icon connect-wallet__button-icon--chrome"
                src={ConcordiumIcon}
                alt="wallet connect icon"
            />
            Concordium Wallet for Web
        </button>
    );
}

/**
 * Trigger to open sidebar when no connection is available
 */
function SelectConnectionTrigger() {
    const showSidebar = useAtomValue(connectionViewAtom);

    return (
        <Button variant="primary" onClick={() => showSidebar?.()}>
            Connect
        </Button>
    );
}

/**
 * Sidebar title when no connection is available
 */
function SelectConnectionTitle() {
    return <>Select wallet</>;
}

/**
 * Sidebar body when no connection is available
 */
function SelectConnectionBody() {
    return (
        <>
            <ConnectBrowser />
            <ConnectWalletConnect />
        </>
    );
}

type WalletWithAccount = Omit<Wallet, 'account'> & {
    account: AccountAddress.Type;
};

/**
 * HoC for making components which assume and use a connection with a connected account.
 *
 * @param Component - A component which takes an extension of {@linkcode WalletWithAccount} as its props.
 *
 * @throws if the returned component is used without a connected account in the global store.
 * @returns A component which has a connection and a connected account passed to it through its props.
 */
function withActiveAccount<P>(Component: React.ComponentType<P & WalletWithAccount>) {
    return function Inner(props: P) {
        const wallet = useAtomValue(activeWalletAtom);

        if (wallet?.account === undefined) {
            throw new Error('Connection must be available');
        }

        return <Component {...props} {...wallet} account={wallet.account} />;
    };
}

/**
 * Trigger to open sidebar when an account is connected.
 *
 * @throws if used without a connected account in the global store.
 */
const ActiveConnectionTrigger = withActiveAccount(({ account }) => {
    const showSidebar = useAtomValue(connectionViewAtom);

    return (
        <Button variant="outline-success" onClick={() => showSidebar?.()}>
            {accountShowShort(account)}
        </Button>
    );
});

/**
 * Sidebar title used when an account is connected.
 *
 * @throws if used without a connected account in the global store.
 */
const ActiveConnectionTitle = withActiveAccount(({ account }) => {
    return (
        <div>
            <div>Connected</div>
            <div className="active-connection__sub-title">{accountShowShort(account)}</div>
        </div>
    );
});

/**
 * Conversion helper to convert submission progress step to percent
 */
const stepToProgress = (step: 1 | 2 | 3) => Math.ceil((step / 3) * 100);
/**
 * Map of {@linkcode BallotSubmissionStatus} to {@linkcode ProgressBarProps}
 */
const statusProgress: { [p in BallotSubmissionStatus]: Partial<ProgressBarProps> } = {
    [BallotSubmissionStatus.Committed]: { now: stepToProgress(1), variant: 'info', animated: true },
    [BallotSubmissionStatus.Rejected]: { now: stepToProgress(1), variant: 'danger' },
    [BallotSubmissionStatus.Approved]: { now: stepToProgress(2), variant: 'info', animated: true },
    [BallotSubmissionStatus.Discarded]: { now: stepToProgress(2), variant: 'danger' },
    [BallotSubmissionStatus.Verified]: { now: stepToProgress(3), variant: 'success' },
};
/**
 * Map of {@linkcode BallotSubmissionStatus} to status description
 */
const showStatus: { [p in BallotSubmissionStatus]: string } = {
    [BallotSubmissionStatus.Committed]: 'Ballot submitted to chain',
    [BallotSubmissionStatus.Rejected]: 'Ballot rejected by chain',
    [BallotSubmissionStatus.Approved]: 'Ballot finalized on chain',
    [BallotSubmissionStatus.Discarded]: 'Ballot verification failed',
    [BallotSubmissionStatus.Verified]: 'Ballot has been included in election tally',
};

/**
 * Shows the details and actions of the connected account.
 *
 * @throws if used without a connected account in the global store.
 */
const ActiveConnectionBody = withActiveAccount(({ connection, account }) => {
    const submissions = useAtomValue(submittedBallotsAtom);
    const loadMore = useSetAtom(loadMoreSubmittedBallotsAtom);
    const [loading, setLoading] = useState(false);
    const weight = useAtomValue(activeWalletVotingWeightAtom);

    const handleLoadMore = useCallback(async () => {
        setLoading(true);

        try {
            await loadMore();
        } finally {
            setLoading(false);
        }
    }, [loadMore]);

    const isDelegatee = (weight?.delegationsFrom.results.length ?? 0) > 0;

    return (
        <>
            <section className="mb-4">
                <h5>Actions</h5>
                <Button variant="danger" size="sm" onClick={() => connection.disconnect()}>
                    Disconnect
                </Button>
            </section>
            {weight !== undefined && (
                <>
                    <hr />
                    <section className="mb-4">
                        <h5>Account details</h5>
                        <div className="active-connection__text-small">
                            Voting weight: {weight?.votingWeight.toString()} CCD*
                            {AccountAddress.instanceOf(weight?.delegatedTo) && (
                                <b> (delegated to {accountShowShort(weight.delegatedTo)})</b>
                            )}
                        </div>
                        {isDelegatee && (
                            <div className="active-connection__text-small mt-3">
                                <b>Delegatee for**:</b>
                                {weight?.delegationsFrom.results.map(([account, weight]) => (
                                    <div key={AccountAddress.toBase58(account)}>
                                        {accountShowShort(account)} (delegated weight: {weight.toString()} CCD)
                                    </div>
                                ))}
                                {weight?.delegationsFrom.hasMore && (
                                    <>
                                        ...
                                        <br />
                                        <Link to={getDelegationRoute(account)}>View all</Link>
                                    </>
                                )}
                            </div>
                        )}
                        <div className="active-connection__text-small mt-3 text-muted">
                            *The voting weight listed does not include any delegated weight from other accounts.
                        </div>
                        {isDelegatee && (
                            <div className="active-connection__text-small mt-1 text-muted">
                                **The delegations listed are delegations made as of {weight?.updatedAt.toLocaleString()}{' '}
                                and can change until voting closes. Delegated weight is not counted until after voting
                                has concluded.
                            </div>
                        )}
                    </section>
                </>
            )}
            <hr />
            <section>
                <h5>Ballot submissions</h5>
                {submissions?.ballots.length === 0 && (
                    <span className="active-connection__text-small text-muted">
                        No ballot submissions registered for the selected account
                    </span>
                )}
                {submissions?.ballots.map(({ status, transaction, submitted }, i, arr) => {
                    const transactionString = TransactionHash.toHexString(transaction);
                    const isLatest = i === 0;
                    const activeSubmission =
                        isLatest || arr.slice(0, i).every((s) => s.status !== BallotSubmissionStatus.Verified);

                    return (
                        <div
                            key={transactionString}
                            className={clsx(
                                'active-connection__submission mb-2',
                                !activeSubmission && 'active-connection__submission--inactive',
                            )}
                        >
                            <div className="mb-1">
                                <div>
                                    {transactionString.slice(0, 8)} (
                                    {submitted.toLocaleTimeString(undefined, commonDateTimeFormat)})
                                </div>
                                <div className="active-connection__submission-status">{showStatus[status]}</div>
                            </div>
                            <ProgressBar {...statusProgress[status]} />
                        </div>
                    );
                })}
                {submissions?.hasMore && (
                    <div className="d-flex justify-content-center mt-4">
                        <Button variant="secondary" size="sm" onClick={handleLoadMore} disabled={loading}>
                            Load more
                        </Button>
                    </div>
                )}
            </section>
        </>
    );
});

type ConnectionProps = {
    modalState: [boolean, Dispatch<SetStateAction<boolean>>];
}

function SelectConnection({modalState: [showModal, setShowModal]}: ConnectionProps) {
    return (
        <>
            <SelectConnectionTrigger />
            <Offcanvas show={showModal} onHide={() => setShowModal(false)} placement="end">
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title className="d-flex">
                        <SelectConnectionTitle />
                    </Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    <SelectConnectionBody />
                </Offcanvas.Body>
            </Offcanvas>
        </>
    )
}

function ActiveConnection({modalState: [showModal, setShowModal]}: ConnectionProps) {
    return (
        <>
            <ActiveConnectionTrigger />
            <Offcanvas show={showModal} onHide={() => setShowModal(false)} placement="end">
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title className="d-flex">
                        <ActiveConnectionTitle />
                    </Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    <ActiveConnectionBody />
                </Offcanvas.Body>
            </Offcanvas>
        </>
    )
}

/**
 * Component which shows the active connection state (if any), and allows the user to manage the connection and view
 * details pertaining to the connected account.
 */
export function WalletConnection() {
    const wallet = useAtomValue(activeWalletAtom);
    const modalState = useState(false);
    const [, setShowModal] = modalState;
    const setConnectionViewHandler = useSetAtom(connectionViewAtom);

    useEffect(() => {
        setConnectionViewHandler(() => () => setShowModal(true)); // atom setter interprets a function as a `SetStateAction`, which is why we pass an action which returns a function.
        return () => setConnectionViewHandler(RESET);
    }, [setConnectionViewHandler, setShowModal]);

    if (wallet?.account !== undefined) {
        return <ActiveConnection modalState={modalState} />
    }

    return (
        <SelectConnection modalState={modalState} />
    );
}
