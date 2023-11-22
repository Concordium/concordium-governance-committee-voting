import { useCallback, useEffect, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { useAtomValue, useSetAtom } from 'jotai';
import { RESET } from 'jotai/utils';

import { useBrowserWallet, useWalletConnect } from '@shared/wallet-connection';
import WalletConnectIcon from '@assets/walletconnect.svg';
import ConcordiumIcon from '@assets/ccd.svg';
import DisconnectIcon from '@assets/close.svg';
import { activeWalletAtom, selectConnectionAtom } from '@shared/store';
import { AccountAddress } from '@concordium/web-sdk';

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
    const setSelectConnectionHandler = useSetAtom(selectConnectionAtom);

    useEffect(() => {
        setSelectConnectionHandler(() => () => setShowModal(true)); // atom setter interprets a function as a `SetStateAction`, which is why we pass an action which returns a function.
        return () => setSelectConnectionHandler(RESET);
    }, [setSelectConnectionHandler]);

    return (
        <>
            <Button variant="primary" onClick={() => setShowModal(true)}>
                Connect
            </Button>
            <Modal show={showModal} onHide={() => setShowModal(false)} backdrop="static">
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
    const wallet = useAtomValue(activeWalletAtom);

    if (wallet?.account === undefined) {
        throw new Error('Connection must be available');
    }

    const accountString = AccountAddress.toBase58(wallet.account);
    const accountShow = `${accountString.substring(0, 4)}...${accountString.substring(accountString.length - 5)}`;

    return (
        <Button
            className="active-connection__disconnect"
            variant="danger"
            onClick={() => wallet.connection.disconnect()}
        >
            {accountShow}
            <img src={DisconnectIcon} alt="disconnect icon" />
        </Button>
    );
}

export function WalletConnection() {
    const wallet = useAtomValue(activeWalletAtom);

    if (wallet?.account !== undefined) {
        return <ActiveConnection />;
    }

    return <SelectConnection />;
}
