import { useCallback, useEffect, useState } from 'react';
import { Button, Offcanvas } from 'react-bootstrap';
import { useAtomValue, useSetAtom } from 'jotai';
import { RESET } from 'jotai/utils';

import { useBrowserWallet, useWalletConnect } from '@shared/wallet-connection';
import WalletConnectIcon from '@assets/walletconnect.svg';
import ConcordiumIcon from '@assets/ccd.svg';
import { Wallet, activeWalletAtom, selectConnectionAtom, submittedBallotsAtom } from '@shared/store';
import { AccountAddress } from '@concordium/web-sdk';
import { accountShowShort } from '@shared/util';

function ConnectWalletConnect() {
    const { isActive, isConnecting, connect: _connect } = useWalletConnect();

    const connect = useCallback(() => {
        if (isActive || isConnecting) {
            return;
        }

        void _connect();
    }, [_connect, isActive, isConnecting]);

    return (
        <button onClick={connect} className="clear connect-wallet__button">
            <img className="connect-wallet__button-icon" src={WalletConnectIcon} alt="wallet connect icon" />
            Concordium Mobile Wallet
        </button>
    );
}

function ConnectBrowser() {
    const { isActive, isConnecting, connect: _connect } = useBrowserWallet();

    const connect = useCallback(() => {
        if (isActive || isConnecting) {
            return;
        }

        void _connect();
    }, [_connect, isActive, isConnecting]);

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

function SelectConnection() {
    const showSidebar = useAtomValue(selectConnectionAtom);

    return (
        <Button variant="primary" onClick={() => showSidebar?.()}>
            Connect
        </Button>
    );
}

function SelectConnectionTitle() {
    return <>Select wallet</>;
}

function SelectConnectionBody() {
    return (
        <Offcanvas.Body>
            <ConnectBrowser />
            <ConnectWalletConnect />
        </Offcanvas.Body>
    );
}

type WalletWithAccount = Omit<Wallet, 'account'> & {
    account: AccountAddress.Type;
};

function withActiveAccount<P>(Component: React.ComponentType<P & WalletWithAccount>) {
    return function Inner(props: P) {
        const wallet = useAtomValue(activeWalletAtom);

        if (wallet?.account === undefined) {
            throw new Error('Connection must be available');
        }

        return <Component {...props} {...wallet} account={wallet.account} />;
    };
}

const ActiveConnection = withActiveAccount(({ account }) => {
    const showSidebar = useAtomValue(selectConnectionAtom);

    return (
        <Button variant="outline-success" onClick={() => showSidebar?.()}>
            {accountShowShort(account)}
        </Button>
    );
});

const ActiveConnectionTitle = withActiveAccount(({ account }) => {
    return (
        <Offcanvas.Title className="d-flex">
            <div>
                <div>Connected</div>
                <div className="active-connection__sub-title">{accountShowShort(account)}</div>
            </div>
        </Offcanvas.Title>
    );
});

const ActiveConnectionBody = withActiveAccount(({ connection }) => {
    const submissions = useAtomValue(submittedBallotsAtom);

    return (
        <Offcanvas.Body>
            <section className="mb-4">
                <h5>Actions</h5>
                <Button variant="danger" size="sm" onClick={() => connection.disconnect()}>
                    Disconnect
                </Button>
            </section>
            <section>
                <h5>Ballot submissions</h5>
                {submissions
                    ?.map((s) => s.toJSON())
                    .map((s) => (
                        <div key={s.transaction}>
                            {s.transaction.slice(0, 8)} - {s.status}
                        </div>
                    ))}
            </section>
        </Offcanvas.Body>
    );
});

const activeConn = {
    Show: ActiveConnection,
    Title: ActiveConnectionTitle,
    Body: ActiveConnectionBody,
};

const selectConn: typeof activeConn = {
    Show: SelectConnection,
    Title: SelectConnectionTitle,
    Body: SelectConnectionBody,
};

export function WalletConnection() {
    const wallet = useAtomValue(activeWalletAtom);
    const [showModal, setShowModal] = useState(false);
    const setSelectConnectionHandler = useSetAtom(selectConnectionAtom);

    useEffect(() => {
        setSelectConnectionHandler(() => () => setShowModal(true)); // atom setter interprets a function as a `SetStateAction`, which is why we pass an action which returns a function.
        return () => setSelectConnectionHandler(RESET);
    }, [setSelectConnectionHandler]);

    const { Show, Title, Body } = wallet?.account !== undefined ? activeConn : selectConn;

    return (
        <>
            <Show />
            <Offcanvas show={showModal} onHide={() => setShowModal(false)} placement="end">
                <Offcanvas.Header closeButton>
                    <Title />
                </Offcanvas.Header>
                <Body />
            </Offcanvas>
        </>
    );
}
