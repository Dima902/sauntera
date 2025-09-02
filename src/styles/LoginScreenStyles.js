// LoginScreenStyles.js
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1, // allow ImageBackground to fill the whole screen
  },

  // Semi-transparent color wash over the bg image
  overlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between', // push disclaimer down
    alignItems: 'center',
    backgroundColor: 'rgba(0, 29, 58, 0.44)',
    paddingHorizontal: 30,
    // NOTE: paddingTop/paddingBottom now come from safe-area insets in the component
  },

  contentWrapper: {
    alignItems: 'center',
    width: '100%',
  },

  logoText: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 60,
  },

  sloganText: {
    fontSize: 20,
    color: '#eee',
    marginBottom: 90,
    textTransform: 'uppercase',
  },

  altLoginButton: {
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  altLoginText: {
    color: 'black',
    fontSize: 15,
    fontWeight: 'bold',
  },

  disclaimerWrapper: {
    paddingHorizontal: 24,
    // bottom spacing comes from safe area via container paddingBottom
  },
  disclaimerText: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#add8e6',
    textDecorationLine: 'underline',
  },
});

export default styles;
