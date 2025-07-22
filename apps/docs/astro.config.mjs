// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  integrations: [
      starlight({
          title: 'Pi Architecture',
          social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
          sidebar: [
              {
                  label: 'Getting Started',
                  items: [
                      { label: 'Introduction', slug: 'introduction' },
                      { label: 'Quick Start', slug: 'getting-started/quick-start' },
                      { label: 'Installation', slug: 'getting-started/installation' },
                  ],
              },
              {
                  label: 'Tutorials',
                  items: [
                      { label: 'Your First Pi App', slug: 'tutorials/first-app' },
                      { label: 'Building a CRUD Feature', slug: 'tutorials/crud-feature' },
                      { label: 'Forms and Validation', slug: 'tutorials/forms' },
                      { label: 'Modals and Dialogs', slug: 'tutorials/modals' },
                  ],
              },
              {
                  label: 'How-to Guides',
                  items: [
                      { label: 'Configure Navigation', slug: 'guides/navigation' },
                      { label: 'Handle Async Operations', slug: 'guides/async-operations' },
                      { label: 'Test Your Routes', slug: 'guides/testing' },
                      { label: 'Debug with Redux DevTools', slug: 'guides/debugging' },
                  ],
              },
              {
                  label: 'Reference',
                  items: [
                      { label: 'API Reference', slug: 'reference/api' },
                      { label: 'Router Middleware', slug: 'reference/middleware' },
                      { label: 'Type Safety', slug: 'reference/type-safety' },
                      { label: 'Redux Integration', slug: 'reference/redux' },
                  ],
              },
              {
                  label: 'Concepts',
                  items: [
                      { label: 'Architecture Overview', slug: 'concepts/architecture' },
                      { label: 'Redux-First Design', slug: 'concepts/redux-first' },
                      { label: 'AI-Friendly Development', slug: 'concepts/ai-friendly' },
                  ],
              },
          ],
      }),
	],

  adapter: cloudflare({
      platformProxy: {
          enabled: true
      },

      imageService: "cloudflare"
  }),
});