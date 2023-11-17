import * as ccdJsGen from '@concordium/ccd-js-gen';
import { ContractAddress } from '@concordium/web-sdk';
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs';
import 'dotenv/config';

const { hostname, port, protocol } = new URL(process.env.CCD_ELECTION_NODE);

// const [,PROTOCOL,GRPC_ADDRESS,GRPC_PORT] = process.env.CCD_ELECTION_NODE?.match(/(https?):\/\/(.*):([0-9]*)/) ?? (() => { throw new Error('Could not parse node URL')})();
// const GRPC_ADDRESS =
const [, index, subindex] =
    process.env.CCD_ELECTION_CONTRACT_ADDRESS.match(/<(\d*),(\d*)>/) ??
    (() => {
        throw new Error('Unexpected format of environment variable "CONTRACT_ADDRESS"');
    })();
const contractAddress = ContractAddress.create(BigInt(index), BigInt(subindex));

const outDirPath = './src/__generated__/election-contract'; // The directory to use for the generated files.
const outputModuleName = 'module'; // The name to give the output smart contract module.

const grpc = new ConcordiumGRPCNodeClient(
    hostname,
    Number(port),
    protocol.match(/https/) ? credentials.createSsl() : credentials.createInsecure(),
);
const contractInfo = await grpc.getInstanceInfo(contractAddress);

// Fetch the smart contract module source from chain.
const moduleSource = await grpc.getModuleSource(contractInfo.sourceModule);

// Generate the smart contract clients from module source.
console.info('Generating smart contract module clients.');
await ccdJsGen.generateContractClients(moduleSource, outputModuleName, outDirPath, { output: 'TypeScript' });
console.info('Code generation was successful.');
