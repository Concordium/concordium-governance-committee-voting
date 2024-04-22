import { InvokeContractResult } from '@concordium/web-sdk/types';
import * as ElectionContract from '../../__generated__/election-contract/module_election';

type WorkerMessage<T> = {
  id: number;
  tag: T;
  message: InvokeContractResult;
};

export type WorkerResponse<R> = {
  /** Corresponding to {@linkcode WorkerMessage.id} */
  id: number;
  response: R;
};

export const enum ElectionContractWorkerTag {
  ParseConfig,
  ParseGuardians,
  ParseElectionResult,
}

export type ElectionContractWorkerMessage = WorkerMessage<ElectionContractWorkerTag.ParseConfig> | WorkerMessage<ElectionContractWorkerTag.ParseGuardians> | WorkerMessage<ElectionContractWorkerTag.ParseElectionResult>;

onmessage = function ({ data }: MessageEvent<ElectionContractWorkerMessage>) {
  let parsed: unknown;
  switch (data.tag) {
    case ElectionContractWorkerTag.ParseConfig:
      parsed = ElectionContract.parseReturnValueViewConfig(data.message);
      break;
    case ElectionContractWorkerTag.ParseGuardians:
      parsed = ElectionContract.parseReturnValueViewGuardiansState(data.message)
      break;
    case ElectionContractWorkerTag.ParseElectionResult:
      parsed = ElectionContract.parseReturnValueViewElectionResult(data.message)
      break;
    default:
      throw new Error('Unsupported tag')
  }

  const response: WorkerResponse<unknown> = { id: data.id, response: parsed };
  postMessage(response);
};
