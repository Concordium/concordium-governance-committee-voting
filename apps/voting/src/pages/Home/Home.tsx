import { TransactionHash } from '@concordium/web-sdk';
import { ElectionContract, registerVotes, useElectionConfig } from '@shared/election-contract';
import { useActiveWallet, useSelectConnection } from '@shared/wallet-connection';
import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Modal, Row } from 'react-bootstrap';

interface CandidateDetails {
    name: string;
    imageUrl: string;
    descriptionUrl: string;
}

interface CandidateProps {
    candidate: CandidateDetails;
    onClick(): void;
    isSelected: boolean;
}

function Candidate({ candidate: { name, imageUrl, descriptionUrl }, onClick, isSelected }: CandidateProps) {
    return (
        <Card role="button" onClick={onClick} className={clsx('candidate', isSelected && 'candidate--selected')}>
            <Card.Img variant="top" src={imageUrl} alt={name} />
            <Card.Body>
                <Card.Title>{name}</Card.Title>
                <Card.Link href={descriptionUrl} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer">
                    Read more
                </Card.Link>
            </Card.Body>
        </Card>
    );
}

export default function Home() {
    const electionConfig = useElectionConfig();
    const [selected, setSelected] = useState<number[]>([]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [awaitConnection, setAwaitConnection] = useState(false);
    const { connection, account } = useActiveWallet();
    const { open: openSelectConnection } = useSelectConnection();

    const toggleCandidate = (i: number) => {
        setSelected((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));
    };

    const closeConfirm = () => setConfirmOpen(false);

    const confirmSubmission = async () => {
        if (connection === undefined || electionConfig === undefined || account === undefined) {
            throw new Error('Expected required parameters to be defined'); // Will not happen.
        }
        const ballot: ElectionContract.RegisterVotesParameter = electionConfig.candidates
            .map((_, i) => selected.includes(i))
            .map((hasVote, i) => ({ candidate_index: i, has_vote: hasVote }));

        const transactionHash = await registerVotes(ballot, connection, account);
        console.log('submitted ballot:', transactionHash);

        closeConfirm();
    };

    const submit = useCallback(() => {
        if (connection === undefined || account === undefined) {
            openSelectConnection();
            setAwaitConnection(true);
        } else {
            setConfirmOpen(true);
        }
    }, [connection, openSelectConnection, account]);

    useEffect(() => {
        if (awaitConnection && connection !== undefined && account !== undefined) {
            submit();
            setAwaitConnection(false);
        }
    }, [awaitConnection, connection, submit, account]);

    if (electionConfig === undefined) {
        return null;
    }

    return (
        <>
            <h1 className="text-center">{electionConfig?.election_description}</h1>
            <Row className="justify-content-md-center">
                {electionConfig?.candidates.map((c, i) => (
                    <Col className="mt-4" key={`${c.name}_${i}`} xs={12} sm={8} md={7} lg={5} xxl={4}>
                        <Candidate
                            candidate={{
                                ...c,
                                // TODO: remove temporary data
                                imageUrl: 'https://picsum.photos/200/150',
                                descriptionUrl: 'https://concordium.com',
                            }}
                            onClick={() => toggleCandidate(i)}
                            isSelected={selected.includes(i)}
                        />
                    </Col>
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
                                {selected
                                    .map((s) => electionConfig.candidates[s])
                                    .map((c, i) => (
                                        <li key={`${c.name}_${i}`}>{c.name}</li>
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
