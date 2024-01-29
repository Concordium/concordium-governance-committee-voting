import { Location, Outlet, useLocation, useNavigate } from 'react-router-dom';

import ArrowIcon from '~/assets/arrow-right.svg?react';

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
    const nav = useNavigate();
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
