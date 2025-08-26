import { StyleSheet } from 'react-native';

export const createEmailLoginStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 24,
      paddingTop: 60,
    },
    backButton: {
      position: 'absolute',
      top: 50,
      left: 20,
      zIndex: 1,
    },
    mainTitle: {
      fontSize: 30,
      fontWeight: '600',
      marginTop: 24,
      marginBottom: 24,
      textAlign: 'left',
      color: theme.text,
    },
    input: {
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      marginBottom: 16,
      color: theme.text,
    },
    disclaimer: {
      fontSize: 13,
      color: theme.text,
      marginBottom: 20,
      lineHeight: 18,
    },
    helpLink: {
      color: theme.primary,
      textDecorationLine: 'underline',
    },
    button: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    buttonDisabled: {
      backgroundColor: theme.border,
    },
    buttonText: {
      color: theme.background,
      fontWeight: 'bold',
      fontSize: 16,
    },
    linkText: {
      marginTop: 20,
      color: theme.text,
      textAlign: 'center',
      textDecorationLine: 'underline',
    },
  });
