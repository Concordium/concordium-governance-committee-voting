export type RoutePath = {
    /** The path of the route */
    path: string;
};
export type RouteNode = RouteChildren & RoutePath;
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type RouteChildren = {
    [key: string]: RouteNode | RoutePath;
};

/**
 * Builds absolute routes from an object of relative routes
 */
export const buildAbsoluteRoutes = <R extends RouteNode | RoutePath | RouteChildren>(route: R, base?: string): R => {
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
