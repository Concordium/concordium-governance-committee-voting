import { ContractAddress } from '@concordium/web-sdk/types';

const { hostname, port, protocol } = new URL(import.meta.env.CCD_ELECTION_NODE);
/** The Concordium node url used for querying data. */
export const GRPC_ADDRESS = `${protocol}//${hostname}`;
/** The port of the GRPC interface of the node accessible at {@linkcode GRPC_ADDRESS} */
export const GRPC_PORT = Number(port);

const [, index, subindex] =
    import.meta.env.CCD_ELECTION_CONTRACT_ADDRESS?.match(/<(\d*),(\d*)>/) ??
    (() => {
        throw new Error(
            'Environment variable "CCD_ELECTION_CONTRACT_ADDRESS" must be specified in the format "<1234,0>"',
        );
    })();

/** The contract address of the election smart contract */
export const CONTRACT_ADDRESS = ContractAddress.create(BigInt(index), BigInt(subindex));
