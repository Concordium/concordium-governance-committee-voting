import { useAtomValue } from 'jotai';
import { RouterProvider } from 'react-router-dom';
import { clsx } from 'clsx';

import { selectedAccountAtom, electionConfigAtom, connectionErrorAtom } from '~/shared/store';
import { router } from '../router';
import { PropsWithChildren, useMemo } from 'react';
import { accountShowShort } from 'shared/util';
import { version } from '../../../package.json';

type ConfigurationItemProps = PropsWithChildren<{
    className?: string;
    /** Whether the configuration item should render as "connected" */
    connected?: boolean;
    /** Whether the configuration item should signal an error */
    error?: boolean;
}>;

/**
 * Renders a configuration item.
 */
function ConfigurationItem({ className, connected = false, children, error = false }: ConfigurationItemProps) {
    return (
        <div className={clsx(className)}>
            <span
                className={clsx(
                    'app-configuration__status',
                    connected && 'app-configuration__status--connected',
                    error && 'app-configuration__status--error',
                )}
            />
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
    const configError = useAtomValue(connectionErrorAtom);
    const hasConnectionError = configError?.type !== undefined;

    return (
        <div className="app-configuration">
            <ConfigurationItem
                className="d-flex align-items-center"
                connected={electionConfig !== undefined && electionConfig !== null}
                error={hasConnectionError}
            >
                {electionConfig === undefined && !hasConnectionError && 'Connecting'}
                {electionConfig === null && !hasConnectionError && 'No election target'}
                {hasConnectionError && 'Failed to connect'}
                {electionConfig !== undefined && electionConfig !== null && (
                    <>
                        {electionConfig.contractAddress.toString()} on {electionConfig.network}
                    </>
                )}
            </ConfigurationItem>
            <ConfigurationItem connected={account !== undefined}>
                {showAccount ?? 'No account selected'}
            </ConfigurationItem>
            <div className="mt-2">v{version}</div>
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
