import React from 'react';
import { StyleSheet } from 'react-native';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> & VariantProps<typeof textStyle>;

// RN-only style keys that are not valid CSS — filter these out before passing to DOM
const RN_ONLY_KEYS = new Set([
  'includeFontPadding',
  'textAlignVertical',
  'writingDirection',
  'elevation',
  'shadowColor',
  'shadowOffset',
  'shadowOpacity',
  'shadowRadius',
]);

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      style: rnStyle,
      ...props
    }: { className?: string; style?: any } & ITextProps,
    ref
  ) {
    // Flatten RN style (may be numeric ID or array) into a plain object,
    // then strip RN-only keys that would break DOM rendering.
    let domStyle: React.CSSProperties | undefined;
    if (rnStyle) {
      const flat: Record<string, any> = StyleSheet.flatten(rnStyle) ?? {};
      const filtered: Record<string, any> = {};
      for (const key of Object.keys(flat)) {
        if (!RN_ONLY_KEYS.has(key)) filtered[key] = flat[key];
      }
      domStyle = Object.keys(filtered).length > 0 ? filtered as React.CSSProperties : undefined;
    }

    return (
      <span
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size: size as "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | undefined,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: className,
        })}
        style={domStyle}
        {...props}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };