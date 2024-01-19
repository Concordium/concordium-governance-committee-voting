import { Spinner } from 'react-bootstrap';
import RBButton, { ButtonProps } from 'react-bootstrap/Button';
import { clsx } from 'clsx';

type Props = ButtonProps & {
    loading?: boolean;
};

export default function Button(props: Props) {
    const { loading = false, disabled, children, className, ...buttonProps } = props;

    return (
        <RBButton
            {...buttonProps}
            disabled={loading || disabled}
            className={clsx('button', loading && 'button--loading', className)}
        >
            <span className="button__text">{children}</span>
            {loading && (
                <div className="button__spinner">
                    <Spinner animation="border" size="sm" />
                </div>
            )}
        </RBButton>
    );
}
