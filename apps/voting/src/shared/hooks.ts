import { useState, useEffect, DependencyList } from 'react';

export function useAsyncMemo<ReturnType>(
    getResult: () => Promise<ReturnType>,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    handleError: (e: Error) => void = () => {},
    deps?: DependencyList,
): ReturnType | undefined {
    const [result, setResult] = useState<ReturnType>();
    useEffect(() => {
        getResult().then(setResult).catch(handleError);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return result;
}
