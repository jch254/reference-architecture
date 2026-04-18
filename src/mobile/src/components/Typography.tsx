import { StyleSheet, Text, type TextProps } from 'react-native';

type TypographyVariant = 'title' | 'body' | 'caption';

interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  children: React.ReactNode;
}

export default function Typography({
  variant = 'body',
  style,
  children,
  ...rest
}: TypographyProps) {
  return (
    <Text style={[styles[variant], style]} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: '#333',
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666',
  },
});
