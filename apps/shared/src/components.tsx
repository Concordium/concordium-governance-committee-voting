import { useMemo } from 'react';
import { formatDuration, intervalToDuration } from 'date-fns';

import { useNow } from './util';

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
