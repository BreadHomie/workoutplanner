import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

export function Button({
  onPress,
  title,
  variant = "primary",
  size = "md",
  icon,
  disabled,
  loading,
  style,
  textStyle,
  fullWidth,
}: ButtonProps) {
  const colors = useColors();

  const getBackgroundColor = () => {
    if (disabled) return colors.muted;
    switch (variant) {
      case "primary":
        return colors.primary;
      case "secondary":
        return colors.secondary;
      case "destructive":
        return colors.destructive;
      case "outline":
      case "ghost":
        return "transparent";
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.mutedForeground;
    switch (variant) {
      case "primary":
        return colors.primaryForeground;
      case "secondary":
        return colors.secondaryForeground;
      case "destructive":
        return colors.destructiveForeground;
      case "outline":
      case "ghost":
        return colors.foreground;
      default:
        return colors.primaryForeground;
    }
  };

  const getBorderColor = () => {
    if (disabled) return "transparent";
    switch (variant) {
      case "outline":
        return colors.border;
      default:
        return "transparent";
    }
  };

  const getHeight = () => {
    switch (size) {
      case "sm":
        return 36;
      case "md":
        return 48;
      case "lg":
        return 56;
      default:
        return 48;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === "outline" ? 1 : 0,
          height: getHeight(),
          borderRadius: colors.radius,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <View style={styles.content}>
          {icon && (
            <Feather
              name={icon}
              size={size === "sm" ? 16 : 20}
              color={getTextColor()}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              { color: getTextColor() },
              size === "lg" && styles.textLg,
              size === "sm" && styles.textSm,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  fullWidth: {
    width: "100%",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  textLg: {
    fontSize: 18,
  },
  textSm: {
    fontSize: 14,
  },
});
