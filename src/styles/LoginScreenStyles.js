//LoginScreenStyles.js
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  disclaimerWrapper: {
    marginTop: 20,
    paddingHorizontal: 24,
  },
  disclaimerText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#add8e6',
    textDecorationLine: 'underline',
  },  
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 29, 58, 0.44)',
    paddingHorizontal: 30,
    paddingTop: 80,
    paddingBottom: 30,
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
  googleloginButton: {
    flexDirection: 'row',
    //backgroundColor: 'white',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
    gap: 10,
  },
  fbloginButton: {
    flexDirection: 'row',
    backgroundColor: '#1877F2',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
    gap: 10,
  },
  googleloginButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fbloginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  iconLeft: {
    marginRight: 8,
  },
  altLoginButton: {
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    //backgroundColor: 'white',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  altLoginText: {
    color: 'black',
    fontSize: 15,
    fontWeight: 'bold',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 30,
    paddingHorizontal: 10,
  },
});

export default styles;
