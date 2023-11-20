import { useElectionConfig } from '@shared/election-contract';
import { Col, Row } from 'react-bootstrap';

export default function Home() {
    const electionConfig = useElectionConfig();
    return (
        <>
            <h1 className='text-center'>{electionConfig?.election_description}</h1>
            <Row className="justify-content-center text-center">
                {electionConfig?.candidates.map((c, i) => (
                    <Col key={`${c.name}_${i}`} xs={6} md={4} lg={3}>
                        {c.name}
                    </Col>
                ))}
            </Row>
        </>
    );
}
