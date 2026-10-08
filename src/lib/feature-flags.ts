/** Where a store opens: Confirmer (labelled "Orders"). */
export function storeHome(storeId: string): string {
	return `/dispatcher/stores/${storeId}/confirmer`;
}
