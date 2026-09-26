/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: 'var(--font-family-heading)',
        body: 'var(--font-family-body)',
        ui: 'var(--font-family-ui)',
      },
      colors: {
        // Surface colors
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        'surface-inverse': 'var(--color-surface-inverse)',
        
        // Text colors
        primary: 'var(--color-text-primary)',
        muted: 'var(--color-text-muted)',
        inverse: 'var(--color-text-inverse)',
        
        // Border colors
        'border-subtle': 'var(--color-border-subtle)',
        'border-strong': 'var(--color-border-strong)',
        'border-focus': 'var(--color-border-focus)',
        
        // Accent colors
        accent: {
          primary: 'var(--color-primary)',
          'primary-hover': 'var(--color-primary-hover)',
          secondary: 'var(--color-secondary)',
          danger: 'var(--color-danger)',
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          info: 'var(--color-info)',
        },
        
        // Category colors
        category: {
          orange: 'var(--color-category-orange)',
          green: 'var(--color-category-green)',
          purple: 'var(--color-category-purple)',
          pink: 'var(--color-category-pink)',
        },
        
        // Interactive states
        'hover-bg': 'var(--color-hover-bg)',
        'active-bg': 'var(--color-active-bg)',
        'disabled-bg': 'var(--color-disabled-bg)',
        'disabled-text': 'var(--color-disabled-text)',
        
        // Brand colors
        'brand-primary': 'var(--color-brand-primary)',
        'brand-primary-hover': 'var(--color-brand-primary-hover)',
        
        // Form placeholder
        'placeholder': 'var(--form-placeholder-color)',
      },
      textColor: {
        primary: 'var(--color-text-primary)',
        muted: 'var(--color-text-muted)',
        inverse: 'var(--color-text-inverse)',
        'inverse-muted': 'var(--color-text-inverse-muted)',
        'inverse-subtle': 'var(--color-text-inverse-subtle)',
        white: 'var(--color-text-white)',
        disabled: 'var(--color-disabled-text)',
        'accent-danger': 'var(--color-danger)',
        'trip-details': 'var(--trip-details-color)',
      },
      backgroundColor: {
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        'surface-inverse': 'var(--color-surface-inverse)',
        hover: 'var(--color-hover-bg)',
        active: 'var(--color-active-bg)',
        disabled: 'var(--color-disabled-bg)',
        'nav': 'var(--color-nav-background)',
      },
      borderColor: {
        DEFAULT: 'var(--color-border-subtle)',
        subtle: 'var(--color-border-subtle)',
        strong: 'var(--color-border-strong)',
        focus: 'var(--color-border-focus)',
        input: 'var(--color-border-input)',
        'trip-card': 'var(--trip-card-border-color)',
      },
      height: {
        input: 'var(--form-element-height)',
      },
      fontSize: {
        'placeholder': 'var(--form-placeholder-font-size)',
        'heading-primary': 'var(--heading-primary-font-size)',
        'logo': 'var(--logo-font-size)',
        'button': 'var(--button-font-size)',
        'ui': 'var(--ui-text-font-size)',
        'nav-label': 'var(--nav-label-font-size)',
        'trip-title': 'var(--trip-title-font-size)',
        'trip-details': 'var(--trip-details-font-size)',
      },
      borderRadius: {
        input: 'var(--form-input-border-radius)',
        button: 'var(--button-border-radius)',
        'trip-card': 'var(--trip-card-border-radius)',
      },
      spacing: {
        'button': 'var(--button-padding)',
      },
      width: {
        'auth-button': '12rem', // 192px - consistent width for auth buttons
      },
      // Form-specific utilities
      ringColor: {
        DEFAULT: 'var(--color-border-focus)',
        primary: 'var(--color-primary)',
        danger: 'var(--color-danger)',
      },
      ringOffsetColor: {
        DEFAULT: 'var(--color-surface)',
      },
      // Animation for form interactions
      animation: {
        'form-error-shake': 'shake 0.5s ease-in-out',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
        },
      },
    },
  },
  plugins: [],
}