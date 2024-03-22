import { PropsWithChildren, useMemo } from 'react';
import { formatDuration, intervalToDuration } from 'date-fns';

import { useNow } from './util';
import { OverlayTrigger, Popover } from 'react-bootstrap';

export type CountdownProps = {
    /** The date to count down towards */
    to: Date;
};

/**
 * Renders a duration until {@linkcode CountdownProps.to} from the current time, updating every second
 */
export function Countdown({ to }: CountdownProps) {
    const start = useNow(1);
    return useMemo(() => {
        const duration = intervalToDuration({ start: start, end: to });
        return formatDuration(duration);
    }, [start, to]);
}

export type ExplainProps = PropsWithChildren<{
    /** The description of the term */
    description: string | JSX.Element;
}>;

/**
 * Renders the text as a term to be explained by the supplied {@linkcode ExplainProps.description}
 */
export function Explain({ children, description }: ExplainProps) {
    return (
        <OverlayTrigger
            placement="auto"
            delay={{ show: 100, hide: 250 }}
            overlay={
                <Popover>
                    <Popover.Body>{description}</Popover.Body>
                </Popover>
            }
        >
            <abbr title="">{children}</abbr>
        </OverlayTrigger>
    );
}
