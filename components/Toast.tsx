import React, { createContext, useContext, useCallback, useRef, useState, useMemo } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme } from '@/constants/Colors';
import { useTheme } from '@/lib/useTheme';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  key: number;
}

type ShowFn = (message: string, type?: ToastType) => void;

const ToastContext = createContext<ShowFn>(() => {});

// Imperative API — set by the provider
let _globalShow: ShowFn = () => {};

export const Toast = {
  show(message: string, type: ToastType = 'info') {
    _globalShow(message, type);
  },
};

const TYPE_COLORS: Record<ToastType, keyof AppTheme> = {
  success: 'green',
  error: 'red',
  info: 'blue',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const show: ShowFn = useCallback((message, type = 'info') => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    keyRef.current += 1;
    setToast({ message, type, key: keyRef.current });

    translateY.setValue(-100);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    hideTimeout.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, 3000);
  }, [translateY, opacity]);

  // Register globally
  _globalShow = show;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.container,
            { top: insets.top + 8, transform: [{ translateY }], opacity },
          ]}
          pointerEvents="none"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <View style={[styles.toast, { borderLeftColor: C[TYPE_COLORS[toast.type]] }]}>
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ShowFn {
  return useContext(ToastContext);
}

const makeStyles = (C: AppTheme) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 4,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
