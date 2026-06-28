/**
 * Web Style Polyfill
 *
 * React Native Web (on this SDK version) does not support `gap` via the
 * indexed CSS property setter, causing:
 *   "Failed to set an indexed property [0] on 'CSSStyleDeclaration'"
 *
 * This polyfill patches StyleSheet.create on web to transparently convert
 * `gap` → `rowGap` + `columnGap` before styles reach the DOM.
 */
import { Platform, StyleSheet } from "react-native";

function patchStyle(style: Record<string, any>): Record<string, any> {
  if (!style || typeof style !== "object") return style;
  if (!("gap" in style)) return style;

  const { gap, ...rest } = style;
  return {
    ...rest,
    rowGap: rest.rowGap ?? gap,
    columnGap: rest.columnGap ?? gap,
  };
}

if (Platform.OS === "web") {
  const original = StyleSheet.create.bind(StyleSheet);
  // @ts-ignore — patching a normally read-only method on web only
  StyleSheet.create = function <T extends StyleSheet.NamedStyles<T>>(
    styles: T
  ): T {
    const patched: Record<string, any> = {};
    for (const key in styles) {
      patched[key] = patchStyle((styles as any)[key]);
    }
    return original(patched as T);
  };
}