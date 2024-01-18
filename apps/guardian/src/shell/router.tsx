import { createBrowserRouter } from 'react-router-dom';
import SelectAccount from '~/pages/SelectAccount/SelectAccount';
import ImportWalletAccount from '~/pages/ImportWalletAccount';
import Actions from '~/pages/Actions';

type RoutePath = {
    path: string;
};
type RouteNode = RouteChildren & RoutePath;
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
type RouteChildren = {
    [key: string]: RouteNode | RoutePath;
};

const relativeRoutes = {
    selectAccount: {
        path: '/',
    },
    importAccount: {
        path: '/import-account',
    },
    actions: {
        path: '/actions'
    },
};

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

export const routes = buildAbsoluteRoutes(relativeRoutes);

export const router = createBrowserRouter([
    {
        path: relativeRoutes.selectAccount.path,
        element: <SelectAccount />,
    },
    { path: relativeRoutes.importAccount.path, element: <ImportWalletAccount /> },
    { path: relativeRoutes.actions.path, element: <Actions /> },
]);
