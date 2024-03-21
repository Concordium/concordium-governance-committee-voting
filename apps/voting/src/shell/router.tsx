import { createBrowserRouter } from 'react-router-dom';
import { RouteChildren, buildAbsoluteRoutes } from 'shared/routing';
import App from './App';
import Home from '~/pages/Home';
import Delegation from '~/pages/Delegation';
import { AccountAddress } from '@concordium/web-sdk';

/**
 * Application relative routes, used by the {@linkcode router}.
 */
const relativeRoutes = {
    /** The home page */
    home: {
        path: '/',
    },
    /** Query delegation status for account */
    delegation: {
        path: '/delegation/:account?',
    }
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
        path: relativeRoutes.home.path,
        element: <App />,
        children: [
            {
                index: true,
                element: <Home />,
            },
            {
                path: relativeRoutes.delegation.path,
                element: <Delegation />,
            },
        ],
    },
]);

export function getDelegationRoute(account?: AccountAddress.Type) {
    return routes.delegation.path.replace(
        '/:account?',
        account !== undefined ? `/${AccountAddress.toBase58(account)}` : '',
    );
}
