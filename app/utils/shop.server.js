// Everything the timer pages need from Shopify in one Admin API call:
// the store's timezone, and titles for any selected products or collections.
export async function getShopContext(admin, resourceIds = []) {
  const response = await admin.graphql(
    `#graphql
      query TimerShopContext($ids: [ID!]!) {
        shop {
          ianaTimezone
        }
        nodes(ids: $ids) {
          id
          ... on Product {
            title
          }
          ... on Collection {
            title
          }
        }
      }`,
    { variables: { ids: resourceIds } },
  );
  const { data } = await response.json();

  return {
    timeZone: data.shop.ianaTimezone,
    // Deleted products and collections come back as null.
    resources: data.nodes.filter(Boolean),
  };
}
