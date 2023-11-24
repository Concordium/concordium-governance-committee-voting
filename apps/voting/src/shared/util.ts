import { AccountAddress } from '@concordium/web-sdk';

/**
 * Type predicate for checking if a value is defined.
 *
 * @param value - The value to check
 */
export function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

/**
 * Helper for updating a map entry in an immutable fashion.
 *
 * @param map - The map to update
 * @param key - The key to update the value at (if `undefined`, a copy of the `map` is returned)
 * @param value - The value to insert at `key` (if `undefined`, a copy of the `map` is returned)
 *
 * @returns A copy of the original `map` with updated value for `key`
 */
export function updateMapEntry<K, V>(map: Map<K, V>, key: K | undefined, value: V | undefined) {
    const res = new Map(map);
    if (key !== undefined) {
        if (value !== undefined) {
            res.set(key, value);
        } else {
            res.delete(key);
        }
    }
    return res;
}

/**
 * Helper for unwrapping values.
 *
 * @param value - The value to unwrap
 * @param error - The error message to construct the {@linkcode Error} with
 *
 * @throws {@linkcode Error} if value is not undefined
 *
 * @returns The unwrapped value.
 */
export function expectValue<T>(value: T | undefined, error: string): T {
    if (value === undefined) {
        throw new Error(error);
    }

    return value;
}

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

/**
 * DateTime format used to display date and time around the application
 */
export const commonDateTimeFormat: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
};
