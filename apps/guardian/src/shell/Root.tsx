import { RouterProvider } from 'react-router-dom';
import { router } from './router';

/**
 * The application root. This is in charge of setting up global contexts to be available from {@linkcode router} and
 * below (in the component tree).
 */
export default function Root() {
    return <RouterProvider router={router} />;
}
