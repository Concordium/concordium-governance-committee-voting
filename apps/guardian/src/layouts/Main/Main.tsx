import { useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';
import { Location, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { expectValue } from 'shared/util';

import ArrowIcon from '~/assets/arrow-right.svg?react';
import Button from '~/shared/Button';
import { connectionErrorAtom, electionConfigAtom, guardiansStateAtom, hasTallyAtom } from '~/shared/store';

function ConnectionError() {
    const connectionError = expectValue(useAtomValue(connectionErrorAtom), 'Connection error expected');
    const reloadElectionConfig = useSetAtom(electionConfigAtom);
    const reloadGuardians = useSetAtom(guardiansStateAtom);
    const reloadTally = useSetAtom(hasTallyAtom);
    const [loading, setLoading] = useState(false);

    const retry = async () => {
        setLoading(true);
        try {
            await Promise.all([reloadElectionConfig(), reloadGuardians(), reloadTally()]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="connection-error">
            <h2 className="text-danger">Failed to connect to election</h2>
            <p className="fs-5">{connectionError.message}</p>
            <Button variant="secondary" onClick={retry} loading={loading}>
                Retry
            </Button>
        </div>
    );
}

/**
 * Location state used by the main layout component.
 */
export type MainLocationState = {
    /** Whether users should be able to go back to the previous page */
    canBack?: boolean;
};

/**
 * Main layout component containing common layout components.
 */
export default function MainLayout() {
    const { state } = useLocation() as Location<MainLocationState>;
    const connectionError = useAtomValue(connectionErrorAtom);
    const nav = useNavigate();

    if (connectionError !== undefined) {
        return <ConnectionError />;
    }

    return (
        <main className="main-layout">
            {state?.canBack && (
                <button className="main-layout__back" onClick={() => nav(-1)}>
                    <ArrowIcon />
                </button>
            )}
            <Outlet />
        </main>
    );
}
