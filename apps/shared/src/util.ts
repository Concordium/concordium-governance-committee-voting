import { Buffer } from 'buffer/index.js';
import { ChecksumUrl } from './types';
import { useEffect, useState } from 'react';
import { AccountAddress } from '@concordium/web-sdk/types';

/**
 * Used to indicate failure to verify a remotely located resource
 */
export class ResourceVerificationError extends Error {}

/**
 * Gets the resource at the specified url.
 * @template T - the JSON type of the resource.
 * @param url - The url and checksum to fetch data from
 * @param [verify] - An optional verification predicate function, which should verify if the fetched data
 * conforms to an expected format. Defaults to a function a predicate that always returns true.
 *
 * @returns (Promise resolves) the resource of type `T`
 * @throws (Promise rejects) with type {@linkcode ResourceVerificationError} if verification of resource fails
 * @throws (Promise rejects) if an error happened while fetching the resource
 */
export async function getChecksumResource<T>(
    { url, hash }: ChecksumUrl,
    verify: (value: unknown) => value is T = (_: unknown): _ is T => true,
): Promise<T> {
    const response = await fetch(url);
    const bData = Buffer.from(await response.arrayBuffer());

    const checksum = await window.crypto.subtle.digest('SHA-256', bData).then((b) => Buffer.from(b).toString('hex'));
    if (checksum !== hash) {
        throw new ResourceVerificationError();
    }

    const data: unknown = JSON.parse(bData.toString('utf8'));
    if (!verify(data)) {
        throw new ResourceVerificationError();
    }

    return data;
}

export const useAsyncMemo = <ReturnType>(
    getResult: () => Promise<ReturnType>,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    handleError: (e: Error) => void = () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deps?: any[],
): ReturnType | undefined => {
    const [result, setResult] = useState<ReturnType>();
    useEffect(() => {
        getResult().then(setResult).catch(handleError);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return result;
};

/**
 * Helper for displaying account addresses in a concise manner (i.e. first/last `numChars/2` characters)
 *
 * @param account - The {@linkcode AccountAddress.Type} to display
 * @param [numChars] - The number of character of the account address to display. Defaults to `8`.
 *
 * @returns The account address format.
 */
export function accountShowShort(account: AccountAddress.Type, numChars = 8): string {
    const half = numChars / 2;
    const start = Math.ceil(half);
    const end = Math.floor(half);
    const accountString = AccountAddress.toBase58(account);
    return `${accountString.substring(0, start)}...${accountString.substring(accountString.length - end)}`;
}
