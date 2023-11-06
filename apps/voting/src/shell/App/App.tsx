import { useCallback, useState } from 'react';
import { useActiveWallet, useBrowserWallet, useWalletConnect } from '@shared/connection';
import { Button, Modal } from 'react-bootstrap';

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
            <div className="connect-wallet__button-icon">icon</div>
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
            <div className="connect-wallet__button-icon">icon</div>
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
