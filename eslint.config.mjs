import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Layer boundaries. Dependencies point inward only:
 *   presentation (src/app, src/features) -> application -> domain
 *   infrastructure -> application ports + domain
 * Only the composition root (`@/infrastructure/container`) and auth session helpers
 * may be imported by presentation code.
 */
const restrict = (groups) => ['error', { patterns: groups }]

const frameworkImports = {
  group: ['payload', 'payload/*', '@payloadcms/*', '@payload-config', '@/payload-types', 'next', 'next/*', 'react', 'react-dom', 'zustand', 'zustand/*'],
  message: 'Inner layers must stay framework-free.',
}

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([
        frameworkImports,
        { group: ['@/application/*', '@/infrastructure/*', '@/features/*', '@/app/*', '@/components/*'], message: 'Domain depends on nothing.' },
      ]),
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([
        frameworkImports,
        { group: ['@/infrastructure/*', '@/features/*', '@/app/*', '@/components/*'], message: 'Application depends on domain and its own ports only.' },
      ]),
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/app/(frontend)/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict([
        {
          group: ['@/infrastructure/payload', '@/infrastructure/payload/*'],
          message: 'Presentation reaches infrastructure only through the composition root or auth session.',
        },
        { group: ['@/payload-types'], message: 'Use domain types in presentation code.' },
      ]),
    },
  },
  {
    ignores: ['.next/', 'src/payload-types.ts', 'src/payload-generated-schema.ts'],
  },
]

export default eslintConfig
