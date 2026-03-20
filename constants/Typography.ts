import { TextStyle } from 'react-native';

/**
 * Shared font tokens extracted from repeated patterns across screens.
 * Usage: [Typography.label, { color: C.textSecondary }]
 */

export const Typography = {
  hero: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  } as TextStyle,

  heading: {
    fontSize: 20,
    fontWeight: '800',
  } as TextStyle,

  title: {
    fontSize: 17,
    fontWeight: '700',
  } as TextStyle,

  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  } as TextStyle,

  badge: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,

  body: {
    fontSize: 15,
    lineHeight: 22,
  } as TextStyle,

  bodySmall: {
    fontSize: 13,
    lineHeight: 19,
  } as TextStyle,

  caption: {
    fontSize: 12,
    fontWeight: '500',
  } as TextStyle,

  btn: {
    fontSize: 15,
    fontWeight: '800',
  } as TextStyle,

  btnSmall: {
    fontSize: 13,
    fontWeight: '700',
  } as TextStyle,

  stat: {
    fontSize: 22,
    fontWeight: '800',
  } as TextStyle,

  statLarge: {
    fontSize: 26,
    fontWeight: '900',
  } as TextStyle,
};

export default Typography;
