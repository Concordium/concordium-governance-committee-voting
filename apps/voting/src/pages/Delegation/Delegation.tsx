import { AccountAddress } from '@concordium/web-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { DelegationsResponse, getDelegations } from '~/shared/election-server';

/**
 * Page for viewing the delegations related to an account
 */
export default function Delegation() {
    const [value, setValue] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const error = useMemo(() => {
        if (!value) return false;
        try {
            AccountAddress.fromBase58(value);
            return false;
        } catch {
            return true;
        }
    }, [value]);

    const [delegations, setDelegations] = useState<DelegationsResponse>();

    const loadDelegations = useCallback(
        async (reset = false) => {
            if (reset) setDelegations(undefined);
            if (error || !value) return;

            setLoading(true);
            const last =
                reset || delegations === undefined || delegations.results.length === 0
                    ? undefined
                    : delegations.results[delegations.results.length - 1].id;

            try {
                const response = await getDelegations(AccountAddress.fromBase58(value), last);
                setDelegations((existing) => {
                    if (existing === undefined) return response;
                    return { ...response, results: [...existing.results, ...response.results] };
                });
            } finally {
                setLoading(false);
            }
        },
        [value, error, delegations],
    );

    useEffect(() => {
        void loadDelegations(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
        <Row className="d-flex flex-fill justify-content-center mt-5">
            <Col md={18} lg={12}>
                <Form className="text-center">
                    <Form.Group className="mb-3" controlId="ccd-account">
                        <Form.Label>Concordium account</Form.Label>
                        <Form.Control
                            className="text-center"
                            type="search"
                            placeholder="Paste concordium account"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            isInvalid={error}
                        />
                        <Form.Control.Feedback type="invalid">Invalid account address.</Form.Control.Feedback>
                    </Form.Group>
                </Form>
                <div className="d-flex flex-column align-items-center">
                    {(delegations !== undefined || loading) && (
                        <>
                            {(delegations?.results.length ?? 0) > 0 &&
                                delegations?.results.map((d) => <div key={d.id.toString()}>{d.id.toString()}</div>)}
                            {loading && <Spinner animation="border" variant="secondary" />}
                            {delegations?.hasMore && !loading && (
                                <Button variant="secondary" onClick={() => loadDelegations()}>
                                    Load more
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </Col>
        </Row>
    );
}
