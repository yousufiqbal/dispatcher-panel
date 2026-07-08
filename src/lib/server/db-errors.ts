const CONNECTION_ERROR_PATTERNS = [
	'fetch failed',
	'econnrefused',
	'enotfound',
	'eai_again',
	'network',
	'timeout',
	'und_err_connect',
	'other side closed'
];

export function isDbConnectionError(err: unknown): boolean {
	const message = errorChainToString(err).toLowerCase();
	return CONNECTION_ERROR_PATTERNS.some((p) => message.includes(p));
}

function errorChainToString(err: unknown): string {
	const parts: string[] = [];
	let current: unknown = err;
	let depth = 0;
	while (current && depth < 5) {
		if (current instanceof Error) {
			parts.push(current.message);
			current = current.cause;
		} else {
			parts.push(String(current));
			current = undefined;
		}
		depth++;
	}
	return parts.join(' ');
}
