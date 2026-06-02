/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: "#f0f0f0",
    tint: "#c4f135",
    background: "#0d0d0f",
    foreground: "#f0f0f0",
    card: "#1a1a1e",
    cardForeground: "#f0f0f0",
    primary: "#c4f135",
    primaryForeground: "#0d0d0f",
    secondary: "#252528",
    secondaryForeground: "#c0c0c0",
    muted: "#1e1e22",
    mutedForeground: "#737380",
    accent: "#c4f135",
    accentForeground: "#0d0d0f",
    destructive: "#ef4444",
    destructiveForeground: "#ffffff",
    border: "#2a2a2e",
    input: "#2a2a2e",
  },
  dark: {
    text: "#f0f0f0",
    tint: "#c4f135",
    background: "#0d0d0f",
    foreground: "#f0f0f0",
    card: "#1a1a1e",
    cardForeground: "#f0f0f0",
    primary: "#c4f135",
    primaryForeground: "#0d0d0f",
    secondary: "#252528",
    secondaryForeground: "#c0c0c0",
    muted: "#1e1e22",
    mutedForeground: "#737380",
    accent: "#c4f135",
    accentForeground: "#0d0d0f",
    destructive: "#ef4444",
    destructiveForeground: "#ffffff",
    border: "#2a2a2e",
    input: "#2a2a2e",
  },
  radius: 12,
};

export default colors;
