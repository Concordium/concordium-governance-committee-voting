import { AccountAddress } from "@concordium/web-sdk";

export function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

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

export function expectValue<T>(value: T | undefined, error: string): T {
    if (value === undefined) {
        throw new Error(error);
    }

    return value;
}

export function accountShowShort(account: AccountAddress.Type, numChars = 8): string {
    const half = numChars / 2;
    const start = Math.ceil(half);
    const end = Math.floor(half);
    const accountString = AccountAddress.toBase58(account);
    return `${accountString.substring(0, start)}...${accountString.substring(accountString.length - end)}`;
}
