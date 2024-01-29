import { Base58String, HexString } from '@concordium/web-sdk/types';

/**
 * Describes an election manifest for Election Guard
 */
export type ElectionManifest = {
    label: string;
    contests: {
        label: string;
        selection_limit: number;
        options: {
            label: string;
        }[];
    }[];
    ballot_styles: {
        label: string;
        contests: number[];
    }[];
};

/**
 * Describes a election parameters for Election Guard
 */
export type ElectionParameters = {
    fixed_parameters: {
        ElectionGuard_Design_Specification: {
            Official: {
                version: number[];
                release: string;
            };
        };
        generation_parameters: {
            q_bits_total: number;
            p_bits_total: number;
            p_bits_msb_fixed_1: number;
            p_middle_bits_source: string;
            p_bits_lsb_fixed_1: number;
        };
        p: string;
        q: string;
        r: string;
        g: string;
    };
    varying_parameters: {
        n: number;
        k: number;
        date: string;
        info: string;
        ballot_chaining: string;
    };
};

/**
 * A guardian public key represented as a byte array.
 */
export type GuardianPublicKey = number[];

/**
 * Representation of a url with associated checksum from the election contract.
 */
export interface ChecksumUrl {
    /** The URL of the resource */
    url: string;
    /** The sha2 checksum */
    hash: HexString;
}

/**
 * Describes a map of account addresses and corresponding voting weights
 */
export type EligibleVoters = Record<Base58String, number>;
