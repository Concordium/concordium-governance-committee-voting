import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import tauriConfig from '../src-tauri/tauri.conf.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NETWORK = process.env.CCD_ELECTION_NETWORK;
if (NETWORK === undefined) {
    throw new Error('Environment variable "CCD_ELECTION_NETWORK" was not found');
}

const [, index, subindex] =
    process.env.CCD_ELECTION_CONTRACT_ADDRESS?.match(/<(\d*),(\d*)>/) ??
    (() => {
        throw new Error(
            'Environment variable "CCD_ELECTION_CONTRACT_ADDRESS" must be specified in the format "<1234,0>"',
        );
    })();

const IDENTIFIER = `${tauriConfig.tauri.bundle.identifier}.${NETWORK}.${index}.${subindex}`;

const config = {
    tauri: {
        bundle: { identifier: IDENTIFIER },
    },
};

const OUT = path.join(__dirname, '..', 'tauri-temp.conf.json');
fs.writeFileSync(OUT, JSON.stringify(config));
