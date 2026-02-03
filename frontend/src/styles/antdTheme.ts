import { ThemeConfig } from 'antd'
import { kcaTokens } from './tokens'

/**
 * Ant Design 5 Theme Configuration for KCA Brand
 *
 * This theme customizes Ant Design components to match KCA visual style:
 * - Orange primary color (#E8752A) instead of blue
 * - Flat design (no rounded corners, no shadows)
 * - 14px base font size (KCA standard)
 * - Border-based styling instead of shadow-based depth
 *
 * IMPORTANT: This only changes visual styling, all component functionality remains unchanged
 */
export const kcaAntdTheme: ThemeConfig = {
  token: {
    // ══════ Color System ══════
    colorPrimary: kcaTokens.colors.primary,        // #E8752A (Orange)
    colorSuccess: kcaTokens.colors.success,        // #4CAF50 (Green)
    colorWarning: kcaTokens.colors.warning,        // #FFC107 (Yellow)
    colorError: kcaTokens.colors.error,            // #F44336 (Red)
    colorInfo: kcaTokens.colors.info,              // #2196F3 (Blue)

    // ══════ Typography ══════
    fontFamily: kcaTokens.typography.fontFamily,   // Noto Sans KR
    fontSize: 14,                                   // Base 14px (KCA standard, changed from 17px)
    fontSizeHeading1: 24,
    fontSizeHeading2: 20,
    fontSizeHeading3: 18,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,

    // ══════ Borders - Flat Style (No Rounded Corners) ══════
    borderRadius: 0,                                // --radius: 0px (KCA flat design)
    borderRadiusSM: 3,                              // --radius-sm: 3px (minimal radius)
    borderRadiusLG: 0,                              // Large border radius = 0
    borderRadiusXS: 0,

    // ══════ Spacing ══════
    controlHeight: 36,                              // Input/Button height
    controlHeightLG: 40,                            // Large control height
    controlHeightSM: 28,                            // Small control height

    // ══════ Layout ══════
    lineHeight: 1.6,                                // Body text line height

    // ══════ Effects - Minimal Shadows (KCA Flat Style) ══════
    boxShadow: 'none',                              // No shadows on cards/modals
    boxShadowSecondary: 'none',                     // No secondary shadows

    // ══════ Colors - Neutrals ══════
    colorText: kcaTokens.colors.text,              // #444444 (body text)
    colorTextSecondary: kcaTokens.colors.textSecondary,  // #666666
    colorTextTertiary: kcaTokens.colors.textMuted,       // #999999
    colorTextQuaternary: kcaTokens.colors.textLight,     // #BBBBBB

    colorBorder: kcaTokens.colors.border,          // #E0E0E0 (default border)
    colorBorderSecondary: kcaTokens.colors.borderLight,  // #EEEEEE

    colorBgContainer: kcaTokens.colors.bg,         // #FFFFFF (white backgrounds)
    colorBgLayout: kcaTokens.colors.bgPage,        // #F7F7F7 (page background)
    colorBgElevated: kcaTokens.colors.bg,          // Elevated backgrounds (modals, dropdowns)
  },

  components: {
    // ══════ Button - Flat Style, Border-Based ══════
    Button: {
      borderRadius: 0,                              // Flat buttons
      primaryShadow: 'none',                        // No shadow on primary
      dangerShadow: 'none',                         // No shadow on danger
      defaultShadow: 'none',                        // No shadow on default
      fontWeight: 600,                              // Semi-bold font
      controlHeight: 36,
      controlHeightLG: 40,
      controlHeightSM: 28,
      paddingContentHorizontal: 22,                 // Horizontal padding
    },

    // ══════ Input - Flat Style ══════
    Input: {
      borderRadius: 0,                              // Flat inputs
      activeShadow: 'none',                         // No shadow on focus
      controlHeight: 36,
      paddingBlock: 10,
      paddingInline: 14,
      hoverBorderColor: kcaTokens.colors.borderDark,
      activeBorderColor: kcaTokens.colors.primary,  // Orange border on focus
    },

    // ══════ Card - No Shadow, Flat Borders ══════
    Card: {
      borderRadius: 0,                              // Flat cards
      boxShadow: 'none',                            // No shadow
      headerBg: kcaTokens.colors.bgLight,           // Light gray header background
      headerHeight: 'auto',
      headerFontSize: 15,
      headerFontSizeSM: 14,
      padding: 24,
      paddingLG: 24,
    },

    // ══════ Table - Clean Borders ══════
    Table: {
      borderRadius: 0,                              // Flat table
      headerBg: kcaTokens.colors.bgPage,            // Gray header background
      headerColor: kcaTokens.colors.textSecondary,  // Secondary text color
      headerSortActiveBg: kcaTokens.colors.bgLight,
      rowHoverBg: kcaTokens.colors.bgLight,         // Hover row background
      borderColor: kcaTokens.colors.borderLight,    // Light border
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },

    // ══════ Modal - Flat Style ══════
    Modal: {
      borderRadius: 0,                              // Flat modal
      contentBg: kcaTokens.colors.bg,
      headerBg: kcaTokens.colors.bgPage,            // Gray header
      titleFontSize: 18,
      titleLineHeight: 1.3,
    },

    // ══════ Form - Consistent Spacing ══════
    Form: {
      labelFontSize: 14,
      labelColor: kcaTokens.colors.dark,            // Dark label color
      labelHeight: 'auto',
      verticalLabelPadding: '0 0 8px',
      itemMarginBottom: 24,                         // Space between form items
    },

    // ══════ Select - Flat Dropdown ══════
    Select: {
      borderRadius: 0,                              // Flat select
      controlHeight: 36,
      optionActiveBg: kcaTokens.colors.bgLight,
      optionSelectedBg: kcaTokens.colors.primaryBg, // Orange background for selected
      optionSelectedColor: kcaTokens.colors.primary,
    },

    // ══════ Tabs - Border-Based Active Indicator ══════
    Tabs: {
      titleFontSize: 15,
      cardGutter: 4,
      horizontalMargin: '0 0 0 0',
      horizontalItemPadding: '12px 24px',
      inkBarColor: kcaTokens.colors.primary,        // Orange indicator
      itemActiveColor: kcaTokens.colors.primary,
      itemHoverColor: kcaTokens.colors.black,
      itemSelectedColor: kcaTokens.colors.primary,
    },

    // ══════ Menu - Flat Navigation Style ══════
    Menu: {
      borderRadius: 0,                              // Flat menu items
      itemActiveBg: 'transparent',
      itemSelectedBg: 'transparent',
      itemSelectedColor: kcaTokens.colors.black,
      horizontalItemSelectedColor: kcaTokens.colors.black,
      itemHeight: 80,                               // Match topbar height
    },

    // ══════ Tag - Border-Based ══════
    Tag: {
      borderRadiusSM: 0,                            // Flat tags
      defaultBg: kcaTokens.colors.bgPage,
      defaultColor: kcaTokens.colors.text,
    },

    // ══════ Steps - Wizard Style ══════
    Steps: {
      dotSize: 26,
      iconSize: 26,
      titleLineHeight: 1.3,
      descriptionMaxWidth: 140,
    },

    // ══════ DatePicker - Flat Style ══════
    DatePicker: {
      borderRadius: 0,
      controlHeight: 36,
    },

    // ══════ InputNumber - Flat Style ══════
    InputNumber: {
      borderRadius: 0,
      controlHeight: 36,
      handleWidth: 28,
    },

    // ══════ Switch - Flat Style ══════
    Switch: {
      trackHeight: 22,
      trackMinWidth: 44,
    },

    // ══════ Radio - Border-Based ══════
    Radio: {
      dotSize: 8,
      radioSize: 16,
    },

    // ══════ Checkbox - Border-Based ══════
    Checkbox: {
      borderRadiusSM: 0,                            // Flat checkbox
      size: 16,
    },

    // ══════ Slider - KCA Style ══════
    Slider: {
      trackBg: kcaTokens.colors.borderLight,
      trackHoverBg: kcaTokens.colors.border,
      handleColor: kcaTokens.colors.primary,
      handleSize: 16,
      handleSizeHover: 18,
      railBg: kcaTokens.colors.borderLight,
      railHoverBg: kcaTokens.colors.border,
    },

    // ══════ Progress - KCA Style ══════
    Progress: {
      defaultColor: kcaTokens.colors.primary,
      remainingColor: kcaTokens.colors.borderLight,
    },

    // ══════ Alert - Flat Style ══════
    Alert: {
      borderRadiusLG: 0,
    },

    // ══════ Badge - Flat Style ══════
    Badge: {
      indicatorHeight: 20,
      indicatorHeightSM: 16,
    },

    // ══════ Pagination - Flat Style ══════
    Pagination: {
      borderRadius: 0,
      itemActiveBg: kcaTokens.colors.primary,
      itemLinkBg: kcaTokens.colors.bg,
    },

    // ══════ Dropdown - Flat Style ══════
    Dropdown: {
      borderRadius: 0,
      boxShadow: 'none',
    },

    // ══════ Popover - Flat Style ══════
    Popover: {
      borderRadius: 0,
    },

    // ══════ Tooltip - Flat Style ══════
    Tooltip: {
      borderRadius: 3,                              // Small radius for tooltip
    },

    // ══════ Drawer - Flat Style ══════
    Drawer: {
      borderRadius: 0,
    },

    // ══════ Notification - Flat Style ══════
    Notification: {
      borderRadiusLG: 0,
    },

    // ══════ Message - Flat Style ══════
    Message: {
      contentBg: kcaTokens.colors.bg,
      borderRadiusLG: 0,
    },
  },
}
