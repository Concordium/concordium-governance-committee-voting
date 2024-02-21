import { useAtomValue } from 'jotai';
import { FC, PropsWithChildren } from 'react';
import { ElectionPhase, TallyStep, electionStepAtom } from '~/shared/store';

const DecryptionError: FC<PropsWithChildren> = ({ children }) => (
    <>
        <h1 className="text-danger">Error:</h1>
        <h3>{children}</h3>
        <p>Please report this to the election facilitator.</p>
    </>
);

export function DecryptionActions() {
    const electionStep = useAtomValue(electionStepAtom);

    if (electionStep?.phase !== ElectionPhase.Tally) {
        return null;
    }

    const { step } = electionStep;

    return (
        <>
            {step === TallyStep.GenerateDecryptionShare && <>Generate decryption share</>}
            {step === TallyStep.AwaitEncryptedTally && <>Waiting for tally to be registered</>}
            {step === TallyStep.TallyError && <DecryptionError>Could not read the election tally</DecryptionError>}
        </>
    );
}
