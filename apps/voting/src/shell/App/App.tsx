import { useCallback, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';

import { useActiveWallet, useBrowserWallet, useWalletConnect } from '@shared/connection';
import WalletConnectIcon from '@assets/walletconnect.svg';
import ChromeIcon from '@assets/chrome.svg';

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
            Wallet Connect
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
                src={ChromeIcon}
                alt="wallet connect icon"
            />
            Concordium Browser Wallet
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

function WalletConnection() {
    const { account, connection } = useActiveWallet();

    return <>{connection ? account : <SelectConnection />}</>;
}

function App() {
    return <WalletConnection />;
}

export default App;
