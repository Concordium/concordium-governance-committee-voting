import { AccountAddress } from '@concordium/web-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Col, Form, Overlay, Row, Spinner, Table, Tooltip } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { accountShowShort } from 'shared/util';
import CopyIcon from '~/assets/copy.svg?react';
import { DelegationsResponse, getDelegations } from '~/shared/election-server';
import { getDelegationRoute } from '~/shell/router';

type AccountCellProps = {
    account: AccountAddress.Type;
};
function AccountCell({ account }: AccountCellProps) {
    const [show, setShow] = useState(false);
    const ref = useRef(null);

    const handleClick = () => {
        void navigator.clipboard.writeText(account.address);
        setShow(true);
        setTimeout(() => {
            setShow(false);
        }, 1000);
    };

    return (
        <>
            <td ref={ref} className="delegation__account" onClick={handleClick}>
                {accountShowShort(account)}
                <CopyIcon />
            </td>
            <Overlay target={ref.current} show={show} placement="top">
                {(props) => <Tooltip {...props}>Copied</Tooltip>}
            </Overlay>
        </>
    );
}

/**
 * Page for viewing the delegations related to an account
 */
export default function Delegation() {
    const { account = '' } = useParams();
    const [value, setValue] = useState<string>(account);
    const [loading, setLoading] = useState<boolean>(false);
    const nav = useNavigate();
    const error = useMemo(() => {
        if (!value) return false;
        try {
            AccountAddress.fromBase58(value);
            return false;
        } catch {
            return true;
        }
    }, [value]);

    const [httpError, setHttpError] = useState(false);
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
                    // Check for reset here as well, as react strictmode renders components twice initially (in dev mode)
                    if (existing === undefined || reset) return response;
                    return { ...response, results: [...existing.results, ...response.results] };
                });
            } catch {
                setHttpError(true);
            } finally {
                setLoading(false);
            }
        },
        [value, error, delegations],
    );

    useEffect(() => {
        void loadDelegations(true);

        if (value && !error) {
            nav(getDelegationRoute(AccountAddress.fromBase58(value)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, error]);

    return (
        <Row className="d-flex flex-fill justify-content-center mt-5">
            <Col md={18} lg={12}>
                <div className="text-center">
                    <Form.Group className="mb-3" controlId="ccd-account">
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
                </div>
                {(delegations !== undefined || loading) && (
                    <div className="d-flex flex-column align-items-center">
                        {delegations?.results.length === 0 && (
                            <span className="text-muted"> No delegations found for account</span>
                        )}
                        {(delegations?.results.length ?? 0) > 0 && (
                            <Table striped bordered hover>
                                <thead>
                                    <tr>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Delegated weight</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {delegations?.results.map((d) => (
                                        <tr key={d.id.toString()}>
                                            <AccountCell account={d.fromAccount} />
                                            <AccountCell account={d.toAccount} />
                                            <td>{d.weight.toString()} CCD</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        )}
                        {loading && <Spinner animation="border" variant="secondary" />}
                        {delegations?.hasMore && !loading && (
                            <Button variant="secondary" onClick={() => loadDelegations()}>
                                Load more
                            </Button>
                        )}
                    </div>
                )}
                {httpError && <div className="text-danger text-center mb-4">Failed to get delegations for account</div>}
            </Col>
        </Row>
    );
}
