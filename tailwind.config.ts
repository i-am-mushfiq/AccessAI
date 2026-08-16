import type { Config } from 'tailwindcss';

/**
 * Bhorosha Design System (BDS) v1.0 — Tailwind binding.
 *
 * Every colour resolves to a CSS custom property so that the three themes
 * (light / dark / sunlight, BDS §3.5 & §3.6) switch without a re-render and
 * without duplicating a single hex value in component code.
 *
 * Tier discipline (BDS §3.1): components may only consume SEMANTIC names from
 * this file. The raw ramp is exposed under `ramp.*` and is reserved for the
 * token layer, charts, and illustrations.
 */

const semantic = (name: string) => `rgb(var(--bds-${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* ---- Tier 1: primitive ramps (token layer / charts / illustration only) ---- */
        ramp: {
          green: {
            50: semantic('green-50'),
            100: semantic('green-100'),
            200: semantic('green-200'),
            300: semantic('green-300'),
            400: semantic('green-400'),
            500: semantic('green-500'),
            600: semantic('green-600'),
            700: semantic('green-700'),
            800: semantic('green-800'),
            900: semantic('green-900'),
            950: semantic('green-950'),
          },
          success: {
            50: semantic('success-50'),
            100: semantic('success-100'),
            300: semantic('success-300'),
            500: semantic('success-500'),
            600: semantic('success-600'),
            700: semantic('success-700'),
          },
          warning: {
            50: semantic('warning-50'),
            100: semantic('warning-100'),
            300: semantic('warning-300'),
            400: semantic('warning-400'),
            500: semantic('warning-500'),
            700: semantic('warning-700'),
          },
          error: {
            50: semantic('error-50'),
            100: semantic('error-100'),
            300: semantic('error-300'),
            500: semantic('error-500'),
            600: semantic('error-600'),
            700: semantic('error-700'),
            800: semantic('error-800'),
          },
          info: {
            50: semantic('info-50'),
            100: semantic('info-100'),
            300: semantic('info-300'),
            500: semantic('info-500'),
            600: semantic('info-600'),
          },
          neutral: {
            0: semantic('neutral-0'),
            50: semantic('neutral-50'),
            100: semantic('neutral-100'),
            200: semantic('neutral-200'),
            300: semantic('neutral-300'),
            400: semantic('neutral-400'),
            500: semantic('neutral-500'),
            600: semantic('neutral-600'),
            700: semantic('neutral-700'),
            800: semantic('neutral-800'),
            900: semantic('neutral-900'),
            950: semantic('neutral-950'),
          },
        },

        /* ---- Tier 2: semantic — text (BDS §3.4) ---- */
        text: {
          primary: semantic('text-primary'),
          secondary: semantic('text-secondary'),
          tertiary: semantic('text-tertiary'),
          disabled: semantic('text-disabled'),
          placeholder: semantic('text-placeholder'),
          'on-brand': semantic('text-on-brand'),
          'on-brand-deep': semantic('text-on-brand-deep'),
          brand: semantic('text-brand'),
          link: semantic('text-link'),
          success: semantic('text-success'),
          warning: semantic('text-warning'),
          error: semantic('text-error'),
        },

        /* ---- Tier 2: semantic — surfaces ---- */
        canvas: {
          DEFAULT: semantic('bg-canvas'),
          plain: semantic('bg-canvas-plain'),
        },
        surface: {
          DEFAULT: semantic('surface-default'),
          raised: semantic('surface-raised'),
          sunken: semantic('surface-sunken'),
          brand: semantic('surface-brand'),
          'brand-subtle': semantic('surface-brand-subtle'),
          success: semantic('surface-success'),
          warning: semantic('surface-warning'),
          error: semantic('surface-error'),
          info: semantic('surface-info'),
          disabled: semantic('surface-disabled'),
          skeleton: semantic('surface-skeleton'),
        },

        /* ---- Tier 2: semantic — borders ---- */
        stroke: {
          DEFAULT: semantic('border-default'),
          strong: semantic('border-strong'),
          subtle: semantic('border-subtle'),
          brand: semantic('border-brand'),
          focus: semantic('border-focus'),
          error: semantic('border-error'),
          success: semantic('border-success'),
          warning: semantic('border-warning'),
          info: semantic('border-info'),
          disabled: semantic('border-disabled'),
        },
      },

      /* Spacing — BDS §6.1, 4 dp base. Tailwind's default numeric scale is
         replaced so that an off-scale value is impossible to express. */
      spacing: {
        0: '0px',
        0.5: '2px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        14: '56px',
        16: '64px',
        18: '72px',
        20: '80px',
        24: '96px',
        // Named touch/layout constants so components never hard-code them.
        'touch-min': '48px',
        'touch-default': '56px',
        'touch-commit': '64px',
        appbar: '56px',
        'appbar-lg': '96px',
        bottomnav: '64px',
        'sticky-footer': '88px',
      },

      borderRadius: {
        none: '0px',
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        pill: '999px',
      },

      borderWidth: {
        DEFAULT: '1px',
        0: '0px',
        1: '1px',
        // BDS §3.4: every functional border (inputs, controls) is 1.5 dp.
        1.5: '1.5px',
        2: '2px',
        2.5: '2.5px',
        3: '3px',
      },

      /* Elevation — BDS §7.2. Warm near-black (neutral.950) shadows, blur
         capped at 16px for anything repeated on a screen. */
      boxShadow: {
        'elev-0': 'none',
        'elev-1': '0 1px 2px rgb(14 18 15 / 0.06), 0 1px 3px rgb(14 18 15 / 0.04)',
        'elev-2': '0 2px 4px rgb(14 18 15 / 0.07), 0 4px 8px rgb(14 18 15 / 0.05)',
        'elev-3': '0 4px 8px rgb(14 18 15 / 0.08), 0 8px 16px rgb(14 18 15 / 0.06)',
        'elev-4': '0 8px 16px rgb(14 18 15 / 0.10), 0 16px 24px rgb(14 18 15 / 0.07)',
        'elev-5': '0 12px 24px rgb(14 18 15 / 0.12), 0 16px 32px rgb(14 18 15 / 0.08)',
        // Dark-mode elevation is surface-lightening + border; only 3+ keeps a shadow.
        'elev-dark-3': '0 4px 12px rgb(0 0 0 / 0.4)',
        'elev-dark-4': '0 8px 24px rgb(0 0 0 / 0.5)',
        'elev-dark-5': '0 12px 32px rgb(0 0 0 / 0.6)',
        // §3.4 focus: 3 dp ring with a 2 dp light offset, guaranteeing ≥3:1
        // against both the control and the page.
        focus: '0 0 0 2px rgb(var(--bds-focus-offset)), 0 0 0 5px rgb(var(--bds-border-focus))',
        'focus-inset': 'inset 0 0 0 3px rgb(var(--bds-border-focus))',
      },

      fontFamily: {
        // Latin listed first on purpose (BDS §4.1): Bangla families ship poor
        // digits, so Latin codepoints and ALL numerals must resolve to Inter.
        // The named Bengali fallbacks cover a cold/offline Next font build on
        // Windows; generic/system fallbacks keep the CSS portable elsewhere.
        body: [
          'var(--font-inter)',
          'var(--font-bengali)',
          'Noto Sans Bengali',
          'Nirmala UI',
          'Kalpurush',
          'Hind Siliguri',
          'SolaimanLipi',
          'system-ui',
          'sans-serif',
        ],
        bengali: [
          'var(--font-bengali)',
          'Noto Sans Bengali',
          'Nirmala UI',
          'Kalpurush',
          'Hind Siliguri',
          'SolaimanLipi',
          'system-ui',
          'sans-serif',
        ],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      screens: {
        // BDS §5.1. 360 dp is the design and review default, not 390.
        xs: '320px',
        sm: '360px',
        md: '414px',
        lg: '600px',
        xl: '905px',
        '2xl': '1280px',
      },

      maxWidth: {
        content: '1200px',
        form: '480px',
        text: '640px',
        dialog: '400px',
        receipt: '420px',
      },

      /* Motion — BDS §13. Durations stay short; `reduce` is honoured globally
         in globals.css rather than per-component. */
      transitionDuration: {
        instant: '80ms',
        fast: '120ms',
        DEFAULT: '180ms',
        moderate: '240ms',
        slow: '320ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        decelerate: 'cubic-bezier(0, 0, 0, 1)',
        accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'tick-draw': {
          from: { strokeDashoffset: '32' },
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.2, 0, 0, 1) both',
        'slide-up': 'slide-up 240ms cubic-bezier(0, 0, 0, 1) both',
        'sheet-in': 'sheet-in 240ms cubic-bezier(0, 0, 0, 1) both',
        shimmer: 'shimmer 1400ms infinite',
        'spin-slow': 'spin-slow 900ms linear infinite',
        'tick-draw': 'tick-draw 320ms cubic-bezier(0, 0, 0, 1) both',
      },

      zIndex: {
        base: '0',
        raised: '10',
        sticky: '20',
        appbar: '30',
        overlay: '40',
        modal: '50',
        toast: '60',
      },
    },
  },
  plugins: [],
};

export default config;
