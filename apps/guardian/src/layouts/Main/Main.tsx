import { Location, Outlet, useLocation, useNavigate } from 'react-router-dom';

import ArrowIcon from '~/assets/arrow-right.svg?react';

export type MainLocationState = {
    canBack?: boolean;
};

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
