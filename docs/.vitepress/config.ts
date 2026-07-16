import { defineConfig } from 'vitepress'

// VitePress configuration for the Training Generator documentation site.
// Theme colors mirror the desktop app (src/styles/tokens.css) and are applied
// via docs/.vitepress/theme/custom.css.
export default defineConfig({
  title: 'Training Generator',
  description: 'AI Training Data Generator Documentation',
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  // Pre-existing docs/*.md files (README.md, troubleshooting.md, etc.) contain
  // relative links to files outside the docs root (project README, .github
  // issue templates). Ignore dead-link checks so those legacy files don't
  // break the build.
  ignoreDeadLinks: true,
  sitemap: {
    hostname: 'https://github.com/richie-rich90454/training-generator'
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#1A73E8' }]
  ],
  themeConfig: {
    siteTitle: 'Training Generator',
    logo: '/favicon.svg',
    // Dark mode toggle is provided by VitePress default theme (appearance: true).
    nav: [
      { text: 'Guide', link: '/getting-started/quick-start' },
      { text: 'Configuration', link: '/configuration/model-settings' },
      { text: 'CLI', link: '/cli/usage' },
      { text: 'Providers', link: '/providers/overview' },
      {
        text: 'More',
        items: [
          { text: 'Architecture', link: '/architecture/overview' },
          { text: 'Troubleshooting', link: '/troubleshooting/common-issues' },
          {
            text: 'Source Repository',
            link: 'https://github.com/richie-rich90454/training-generator'
          }
        ]
      }
    ],
    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Installation', link: '/getting-started/installation' },
            { text: 'Quick Start', link: '/getting-started/quick-start' }
          ]
        }
      ],
      '/configuration/': [
        {
          text: 'Configuration',
          collapsed: false,
          items: [
            { text: 'Model Settings', link: '/configuration/model-settings' },
            { text: 'Output Settings', link: '/configuration/output-settings' }
          ]
        }
      ],
      '/processing/': [
        {
          text: 'Processing',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/processing/overview' }
          ]
        }
      ],
      '/output/': [
        {
          text: 'Output',
          collapsed: false,
          items: [
            { text: 'Formats', link: '/output/formats' }
          ]
        }
      ],
      '/cli/': [
        {
          text: 'CLI',
          collapsed: false,
          items: [
            { text: 'Usage', link: '/cli/usage' }
          ]
        }
      ],
      '/providers/': [
        {
          text: 'Providers',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/providers/overview' }
          ]
        }
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/architecture/overview' }
          ]
        }
      ],
      '/testing/': [
        {
          text: 'Testing',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/testing/overview' }
          ]
        }
      ],
      '/troubleshooting/': [
        {
          text: 'Troubleshooting',
          collapsed: false,
          items: [
            { text: 'Common Issues', link: '/troubleshooting/common-issues' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/richie-rich90454/training-generator' }
    ],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: 'Search documentation',
            buttonAriaLabel: 'Search documentation'
          }
        }
      }
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 richie-rich90454'
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next'
    },
    outline: {
      level: [2, 3],
      label: 'On this page'
    },
    darkModeSwitchLabel: 'Theme',
    sidebarMenuLabel: 'Menu',
    returnToTopLabel: 'Back to top'
  }
})
