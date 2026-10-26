import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// `npm run icons` turns public/app-icon.svg into the PNG icons and
// favicon.ico next to it (commit the results). The maskable and Apple icons
// sit on an aubergine background instead of the preset's white, so the
// padding blends into the tile.
const tile = { background: '#553285' }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: tile },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: tile },
  },
  images: ['public/app-icon.svg'],
})
