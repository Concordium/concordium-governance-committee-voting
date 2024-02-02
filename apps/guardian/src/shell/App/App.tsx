import { useAtomValue } from 'jotai';
import { RouterProvider } from 'react-router-dom';
import { clsx } from 'clsx';

import { selectedAccountAtom, electionConfigAtom } from '~/shared/store';
import { router } from '../router';
import { PropsWithChildren, useMemo } from 'react';
import { accountShowShort } from 'shared/util';

type ConfigurationItemProps = PropsWithChildren<{
    className?: string;
    /** Whether the configuration item should render as "connected" */
    connected: boolean;
}>;

/**
 * Renders a configuration item.
 */
function ConfigurationItem({ className, connected, children }: ConfigurationItemProps) {
    return (
        <div className={clsx(className)}>
            <span className={clsx('app-configuration__status', connected && 'app-configuration__status--connected')} />
            {children}
        </div>
    );
}

/**
 * Renders the application configuration, i.e. the chain, contract, and the guardian account selected.
 */
function Configuration() {
    const electionConfig = useAtomValue(electionConfigAtom);
    const account = useAtomValue(selectedAccountAtom);
    const showAccount = useMemo(() => (account === undefined ? undefined : accountShowShort(account)), [account]);

    return (
        <div className="app-configuration">
            <ConfigurationItem className="text-capitalize" connected={electionConfig !== undefined}>
                {import.meta.env.CCD_ELECTION_NETWORK}
            </ConfigurationItem>
            <ConfigurationItem className="d-flex align-items-center" connected={electionConfig !== undefined}>
                {import.meta.env.CCD_ELECTION_CONTRACT_ADDRESS}
            </ConfigurationItem>
            <ConfigurationItem connected={account !== undefined}>{showAccount ?? 'No account found'}</ConfigurationItem>
        </div>
    );
}

/**
 * The root layout component of the application.
 */
export default function App() {
    return (
        <>
            <RouterProvider router={router} />
            <Configuration />
        </>
    );
}
