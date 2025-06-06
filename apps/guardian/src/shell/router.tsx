import { createBrowserRouter } from 'react-router-dom';
import { RouteChildren, buildAbsoluteRoutes } from 'shared/routing';

import Main from '~/layouts/Main';

import SelectAccount from '~/pages/SelectAccount/SelectAccount';
import ImportWalletAccount from '~/pages/ImportWalletAccount';
import Actions from '~/pages/Actions';
import Setup from '~/pages/Setup';
import { appWindow } from '@tauri-apps/api/window';

/**
 * Application relative routes, used by the {@linkcode router}.
 */
const relativeRoutes = {
    /** Allows user to select the account to load into the app. */
    selectAccount: {
        path: '/',
    },
    /** Setup the app with the target election */
    setup: {
        path: '/setup',
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
    {
        path: relativeRoutes.setup.path,
        element: <Setup />,
    },
]);

void appWindow.listen('open-setup', () => {
    void router.navigate(routes.setup.path);
});
