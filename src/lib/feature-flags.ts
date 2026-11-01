/** Where a store opens: the Confirmer page. */
export function storeHome(storeId: string): string {
	return `/dispatcher/stores/${storeId}/confirmer`;
}
