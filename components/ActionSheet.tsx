import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';

export interface ActionSheetOption {
  label: string;
  icon?: string;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
}

export function ActionSheet({ visible, title, options, onClose }: ActionSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close action sheet"
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {title && <Text style={styles.title}>{title}</Text>}
          {options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.option, i === 0 && !title && styles.optionFirst]}
              onPress={() => {
                onClose();
                opt.onPress();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              {opt.icon && (
                <FontAwesome
                  name={opt.icon as any}
                  size={18}
                  color={opt.destructive ? Colors.red : Colors.text}
                  style={styles.optionIcon}
                />
              )}
              <Text
                style={[
                  styles.optionText,
                  opt.destructive && styles.optionTextDestructive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  optionFirst: {
    borderTopWidth: 0,
  },
  optionIcon: {
    width: 28,
    textAlign: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  optionTextDestructive: {
    color: Colors.red,
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
