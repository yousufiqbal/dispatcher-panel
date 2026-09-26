# Order Image Lightbox (Chrome extension)

On a Shopify admin order page, click any line-item thumbnail to open a
full-screen gallery of every product image on the order — the same lightbox
as the Pro Shipper panel.

- **← / →** move between images · **Esc** or click the backdrop to close
- Swipe left/right on touch screens
- Footer shows product title, variant, and quantity (red when ×2 or more)
- Loads the original full-resolution image, not the 160px thumbnail

It only runs on `admin.shopify.com`, only activates on order pages, makes no
network requests of its own, and stores nothing.

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and choose this `shopify-lightbox` folder
4. Open any order in Shopify admin and click a product thumbnail

Works in Edge and Brave too (`edge://extensions`, `brave://extensions`).

## Updating

After editing `content.js`, click the ↻ reload icon on the extension's card in
`chrome://extensions`, then refresh the Shopify tab.

## If it stops working

Shopify occasionally changes its admin markup. The extension finds thumbnails
by Shopify's `.thumbnail` wrapper, falling back to any `cdn.shopify.com` image
carrying a size suffix such as `_160x160`. If neither matches after a redesign,
clicks just behave normally — nothing breaks. Inspect a thumbnail and update
`isProductThumb()` in `content.js`.
