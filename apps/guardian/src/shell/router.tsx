import { createBrowserRouter } from 'react-router-dom';
import SelectAccount from '~/pages/SelectAccount/SelectAccount';
import ImportWalletAccount from '~/pages/ImportWalletAccount';
import Actions from '~/pages/Actions';
import Main from '~/layouts/Main';

type RoutePath = {
    /** The path of the route */
    path: string;
};
type RouteNode = RouteChildren & RoutePath;
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
type RouteChildren = {
    [key: string]: RouteNode | RoutePath;
};

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
 * Builds absolute routes from an object of relative routes
 */
const buildAbsoluteRoutes = <R extends RouteNode | RoutePath | RouteChildren>(route: R, base?: string): R => {
    const { path, ...rs } = route;

    let aPath = path as string | undefined;
    if (base === '/') {
        aPath = `/${aPath}`;
    } else if (base !== undefined) {
        aPath = `${base}/${aPath}`;
    }

    return Object.entries(rs).reduce(
        (acc, [k, r]) => ({
            ...acc,
            [k]: buildAbsoluteRoutes(r as R, aPath),
        }),
        { path: aPath },
    ) as R;
};

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
