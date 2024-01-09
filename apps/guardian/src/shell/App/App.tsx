import { useAtomValue } from 'jotai';
import { RouterProvider } from 'react-router-dom';

import { electionConfigAtom } from '~/shared/store';
import { router } from '../router';
import clsx from 'clsx';

function Configuration() {
    const electionConfig = useAtomValue(electionConfigAtom);
    return (
        <div className="app-configuration">
            <div className="text-capitalize">
                <span
                    className={clsx(
                        'app-configuration__status',
                        electionConfig && 'app-configuration__status--connected',
                    )}
                />
                {import.meta.env.CCD_ELECTION_NETWORK}
            </div>
            <div className="d-flex align-items-center">
                <span
                    className={clsx(
                        'app-configuration__status',
                        electionConfig && 'app-configuration__status--connected',
                    )}
                />
                {import.meta.env.CCD_ELECTION_CONTRACT_ADDRESS}
            </div>
        </div>
    );
}

export default function App() {
    return (
        <>
            <RouterProvider router={router} />
            <Configuration />
        </>
    );
}
