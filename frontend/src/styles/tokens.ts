/**
 * KCA Brand Design Tokens
 * Extracted from wizard-kca-v2.html
 *
 * Single source of truth for all design values
 */

export const kcaTokens = {
  // Colors - Primary
  colors: {
    primary: '#E8752A',        // --orange (KCA brand color)
    primaryHover: '#D5651D',   // --orange-hover
    primaryBg: '#FFF7F2',      // --orange-bg (light background)

    // Neutrals
    black: '#222222',          // --black (headings)
    dark: '#333333',           // --dark (subheadings)
    text: '#444444',           // --text (body text)
    textSecondary: '#666666',  // --text-secondary
    textMuted: '#999999',      // --text-muted (hints, placeholders)
    textLight: '#BBBBBB',      // --text-light (disabled text)

    // Backgrounds
    bg: '#FFFFFF',             // --bg (pure white)
    bgPage: '#F7F7F7',         // --bg-page (page background)
    bgLight: '#FAFAFA',        // --bg-light (light gray background)

    // Borders
    border: '#E0E0E0',         // --border (default border)
    borderLight: '#EEEEEE',    // --border-light (subtle border)
    borderDark: '#CCCCCC',     // --border-dark (emphasis border)

    // Status Colors
    success: '#4CAF50',        // Green for success states
    warning: '#FFC107',        // Yellow for warnings
    error: '#F44336',          // Red for errors
    info: '#2196F3',           // Blue for information
  },

  // Typography
  typography: {
    fontFamily: "'Noto Sans KR', '맑은 고딕', sans-serif",
    fontSize: {
      base: '14px',      // Base font size (KCA standard)
      tiny: '10px',      // Logo subtitle
      small: '11px',     // Step descriptions, captions
      xs: '12px',        // Form help text, meta info
      normal: '13px',    // Secondary text
      medium: '14px',    // Body text (base)
      large: '15px',     // Navigation items
      xl: '16px',        // Section headers
      h3: '18px',        // H3 headings
      h2: '20px',        // H2 headings
      h1: '24px',        // H1 headings
      logo: '28px',      // PCMS logo
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
    lineHeight: {
      tight: 1.3,        // Headings
      normal: 1.6,       // Body text
      relaxed: 1.8,      // Reading content
    },
    letterSpacing: {
      tight: '-1px',     // Logo
      normal: '-0.5px',  // Headings
      wide: '0.5px',     // Labels
      wider: '1px',      // Section titles
    },
  },

  // Spacing (KCA layout specifications)
  spacing: {
    topbarHeight: '80px',      // Main navigation bar
    subnavHeight: '50px',      // Breadcrumb navigation
    sidebarWidth: '240px',     // Wizard sidebar
    contentPadding: '40px',    // Main content padding
    formPadding: '50px',       // Form panel padding
    cardPadding: '24px',       // Card inner padding
    sectionGap: '24px',        // Gap between sections
    itemGap: '8px',            // Gap between items
  },

  // Effects
  effects: {
    radius: '0px',             // Flat design (no rounded corners)
    radiusSm: '3px',           // Small radius for specific cases
    radiusPill: '20px',        // Pill-shaped buttons (user dropdown)
    transition: '0.2s ease',   // Standard transition
    shadow: 'none',            // No shadows (flat design)
    borderWidth: '1px',        // Standard border width
    borderWidthThick: '2px',   // Emphasis borders
    borderWidthThicker: '3px', // Active indicators
    borderWidthThickest: '5px', // Tab active state
  },

  // Z-index layers
  zIndex: {
    topbar: 100,
    subnav: 99,
    modal: 1000,
    dropdown: 1050,
    tooltip: 1100,
  },
}

/**
 * CSS Custom Properties for runtime access
 * Use these in CSS files with var(--kca-primary)
 */
export const cssVariables = `
  :root {
    /* Colors */
    --kca-primary: ${kcaTokens.colors.primary};
    --kca-primary-hover: ${kcaTokens.colors.primaryHover};
    --kca-primary-bg: ${kcaTokens.colors.primaryBg};

    --kca-black: ${kcaTokens.colors.black};
    --kca-dark: ${kcaTokens.colors.dark};
    --kca-text: ${kcaTokens.colors.text};
    --kca-text-secondary: ${kcaTokens.colors.textSecondary};
    --kca-text-muted: ${kcaTokens.colors.textMuted};
    --kca-text-light: ${kcaTokens.colors.textLight};

    --kca-bg: ${kcaTokens.colors.bg};
    --kca-bg-page: ${kcaTokens.colors.bgPage};
    --kca-bg-light: ${kcaTokens.colors.bgLight};

    --kca-border: ${kcaTokens.colors.border};
    --kca-border-light: ${kcaTokens.colors.borderLight};
    --kca-border-dark: ${kcaTokens.colors.borderDark};

    --kca-success: ${kcaTokens.colors.success};
    --kca-warning: ${kcaTokens.colors.warning};
    --kca-error: ${kcaTokens.colors.error};
    --kca-info: ${kcaTokens.colors.info};

    /* Typography */
    --kca-font-family: ${kcaTokens.typography.fontFamily};
    --kca-font-size: ${kcaTokens.typography.fontSize.base};

    /* Spacing */
    --kca-topbar-height: ${kcaTokens.spacing.topbarHeight};
    --kca-subnav-height: ${kcaTokens.spacing.subnavHeight};
    --kca-sidebar-width: ${kcaTokens.spacing.sidebarWidth};

    /* Effects */
    --kca-radius: ${kcaTokens.effects.radius};
    --kca-radius-sm: ${kcaTokens.effects.radiusSm};
    --kca-transition: ${kcaTokens.effects.transition};
  }
`

/**
 * Export individual token groups for convenient access
 */
export const colors = kcaTokens.colors
export const typography = kcaTokens.typography
export const spacing = kcaTokens.spacing
export const effects = kcaTokens.effects
