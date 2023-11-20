import { useElectionConfig } from '@shared/election-contract';
import clsx from 'clsx';
import { useState } from 'react';
import { Card, Col, Row } from 'react-bootstrap';

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
    const toggleCandidate = (i: number) => {
        setSelected((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));
    };
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
        </>
    );
}
