// SubscriptionModalStyles.js
import { StyleSheet, Dimensions } from 'react-native';

export const createSubscriptionModalStyles = (theme) => {
  const { width, height } = Dimensions.get('window');

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: theme.background,
      paddingVertical: 30,
      paddingHorizontal: 25,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      elevation: 10,
    },
    closeButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    benefitsList: {
      marginTop: 10,
      marginBottom: 25,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    benefitIcon: {
      marginRight: 10,
    },
    benefitText: {
      fontSize: 16,
      color: theme.text,
    },
    upgradeButton: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    upgradeButtonText: {
      fontSize: 16,
      color: '#fff',
      fontWeight: '600',
    },
  });
};
