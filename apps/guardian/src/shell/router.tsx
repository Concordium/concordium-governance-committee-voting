import { createBrowserRouter } from 'react-router-dom';
import { RouteChildren, buildAbsoluteRoutes } from 'shared/routing';

import SelectAccount from '~/pages/SelectAccount/SelectAccount';
import ImportWalletAccount from '~/pages/ImportWalletAccount';
import Actions from '~/pages/Actions';
import Main from '~/layouts/Main';

/**
 * Application relative routes, used by the {@linkcode router}.
 */
const relativeRoutes = {
    /** Allows user to select the account to load into the app. */
    selectAccount: {
        path: '/',
    },
    /** Allows the user to import a new account into the app. */
    importAccount: {
        path: '/import-account',
    },
    /** The path where guardian actions can be accessed */
    actions: {
        path: '/actions',
    },
} satisfies RouteChildren;

/**
 * The absolute application routes which can be used for navigating to any page from anywhere in the application.
 */
export const routes = buildAbsoluteRoutes(relativeRoutes);

/**
 * The application router.
 */
export const router = createBrowserRouter([
    {
        path: '/',
        element: <Main />,
        children: [
            {
                path: relativeRoutes.selectAccount.path,
                element: <SelectAccount />,
            },
            { path: relativeRoutes.importAccount.path, element: <ImportWalletAccount /> },
            { path: relativeRoutes.actions.path, element: <Actions /> },
        ],
    },
]);
