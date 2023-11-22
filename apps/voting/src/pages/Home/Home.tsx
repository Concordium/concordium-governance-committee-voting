import { clsx } from 'clsx';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Modal, Row, Image } from 'react-bootstrap';

import { ElectionContract, registerVotes } from '@shared/election-contract';
import {
    IndexedCandidateDetails,
    addSubmittedBallotAtom,
    electionConfigAtom,
    selectConnectionAtom,
    activeWalletAtom
} from '@shared/store';

interface CandidateProps {
    candidate: IndexedCandidateDetails;
    onClick(): void;
    isSelected: boolean;
}

function Candidate({ candidate: { name, imageUrl, descriptionUrl }, onClick, isSelected }: CandidateProps) {
    return (
        <Col className="mt-4" xs={24} md={12} xl={8}>
            <Card role="button" onClick={onClick} className={clsx('candidate', isSelected && 'candidate--selected')}>
                <Image src={imageUrl} alt={name} />
                <Card.Body className='candidate__body'>
                    <Card.Title>{name}</Card.Title>
                    <Card.Link
                        href={descriptionUrl}
                        onClick={(e) => e.stopPropagation()}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Read more
                    </Card.Link>
                </Card.Body>
            </Card>
        </Col>
    );
}

export default function Home() {
    const electionConfig = useAtomValue(electionConfigAtom);
    const [selected, setSelected] = useState<number[]>([]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [awaitConnection, setAwaitConnection] = useState(false);
    const wallet = useAtomValue(activeWalletAtom);
    const openSelectConnection = useAtomValue(selectConnectionAtom);
    const addSubmission = useSetAtom(addSubmittedBallotAtom);

    const toggleCandidate = (i: number) => {
        setSelected((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));
    };

    const closeConfirm = () => setConfirmOpen(false);

    const confirmSubmission = async () => {
        if (wallet?.connection === undefined || electionConfig === undefined || wallet?.account === undefined) {
            throw new Error('Expected required parameters to be defined'); // Will not happen.
        }
        const ballot: ElectionContract.RegisterVotesParameter = electionConfig.candidates
            .map((_, i) => selected.includes(i))
            .map((hasVote, i) => ({ candidate_index: i, has_vote: hasVote }));

        const transaction = await registerVotes(ballot, wallet.connection, wallet.account);
        addSubmission({ transaction, selectedCandidates: selected });
        console.log('submitted ballot:', transaction);

        closeConfirm();
    };

    const submit = useCallback(() => {
        if ((wallet?.connection === undefined || wallet?.account === undefined) && openSelectConnection !== undefined) {
            openSelectConnection();
            setAwaitConnection(true);
        } else {
            setConfirmOpen(true);
        }
    }, [wallet?.connection, openSelectConnection, wallet?.account]);

    useEffect(() => {
        if (awaitConnection && wallet?.connection !== undefined && wallet?.account !== undefined) {
            submit();
            setAwaitConnection(false);
        }
    }, [awaitConnection, wallet?.connection, submit, wallet?.account]);

    if (electionConfig === undefined) {
        return null;
    }

    return (
        <>
            <h1 className="text-center">{electionConfig?.election_description}</h1>
            <Row>
                {electionConfig?.candidates.map((c) => (
                    <Candidate
                        key={c.index}
                        candidate={c}
                        onClick={() => toggleCandidate(c.index)}
                        isSelected={selected.includes(c.index)}
                    />
                ))}
            </Row>
            <div className="d-flex justify-content-center mt-4">
                <Button className="text-center" variant="primary" onClick={submit}>
                    Submit
                </Button>
            </div>
            <Modal show={confirmOpen} onHide={closeConfirm} backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title>Modal heading</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selected.length === 0 && (
                        <p>
                            You have not selected any candidates. Confirming this submission will result in en empty
                            ballot.
                        </p>
                    )}
                    {selected.length === electionConfig.candidates.length && (
                        <p>
                            You have selected all candidates. Confirming this submission will result in a ballot with
                            equal weight distribution on all candidates, which is essentially the same as an empty
                            ballot.
                        </p>
                    )}
                    {0 < selected.length && selected.length < electionConfig.candidates.length && (
                        <>
                            <p>
                                You have selected {selected.length} out of {electionConfig.candidates.length}{' '}
                                candidates:
                            </p>
                            <ul>
                                {electionConfig.candidates
                                    .filter((c) => selected.includes(c.index))
                                    .map((c) => (
                                        <li key={c.index}>{c.name}</li>
                                    ))}
                            </ul>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={closeConfirm}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={confirmSubmission}>
                        Confirm
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}
