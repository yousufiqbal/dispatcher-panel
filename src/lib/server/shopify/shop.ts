import { shopifyRequest, type ShopifyClient } from './client';

export async function getShopLogoUrl(client: ShopifyClient): Promise<string | null> {
	const gql = `
		query ShopBrand {
			shop {
				brand {
					squareLogo { image { url } }
					logo { image { url } }
				}
			}
		}
	`;
	try {
		const data = await shopifyRequest<{
			shop: { brand: { squareLogo: { image: { url: string } | null } | null; logo: { image: { url: string } | null } | null } | null };
		}>(client, gql);
		return data.shop.brand?.squareLogo?.image?.url ?? data.shop.brand?.logo?.image?.url ?? null;
	} catch {
		// Shop Brand may be unavailable on some plans/API versions — fall back silently.
		return null;
	}
}
