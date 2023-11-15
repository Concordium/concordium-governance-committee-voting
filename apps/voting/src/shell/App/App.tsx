import { useCallback, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';

import { useActiveWallet, useBrowserWallet, useWalletConnect } from '@shared/connection';
import WalletConnectIcon from '@assets/walletconnect.svg';
import ConcordiumIcon from '@assets/ccd.svg';
import DisconnectIcon from '@assets/close.svg';

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
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <Button variant="primary" onClick={() => setShowModal(true)}>
                Connect
            </Button>
            <Modal show={showModal} onHide={() => setShowModal(false)} animation={false}>
                <Modal.Header closeButton>Select wallet</Modal.Header>
                <Modal.Body className="select-connection__wallets">
                    <ConnectBrowser />
                    <ConnectWalletConnect />
                </Modal.Body>
            </Modal>
        </>
    );
}

function ActiveConnection() {
    const { account, connection } = useActiveWallet();

    if (!connection) {
        throw new Error('Connection must be available');
    }

    const accountShow = `${account?.substring(0, 4)}...${account?.substring(account.length - 5)}`;

    return (
        <Button className="active-connection__disconnect" variant="danger" onClick={() => connection.disconnect()}>
            {accountShow}
            <img src={DisconnectIcon} alt="disconnect icon" />
        </Button>
    );
}

function WalletConnection() {
    const { connection } = useActiveWallet();

    if (connection) {
        return <ActiveConnection />;
    }

    return <SelectConnection />;
}

function App() {
    return (
        <div className="float-end">
            <WalletConnection />
        </div>
    );
}

export default App;
