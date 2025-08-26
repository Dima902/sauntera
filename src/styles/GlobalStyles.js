// GlobalStyles.js
import { StyleSheet } from 'react-native';
import Colors from '../constants/colors';

const GlobalStyles = StyleSheet.create({
  // GENERAL
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // TYPOGRAPHY
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  subheading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  bodyText: {
    fontSize: 14,
    color: Colors.text,
  },
  linkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  subheadingRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20
  },

  // BUTTONS
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  successButton: {
    backgroundColor: Colors.success,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  successButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
  },

  // CARDS
  card: {
    width: '90%',
    height: 305,
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 15,
    elevation: 5,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    alignSelf: 'center',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,  // Adds spacing before the Save button
  },
  cardHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between', // Title on the left, Save button on the right
    alignItems: 'center',
  },
  cardDescription: {
    fontSize: 14
  },
  cardPrice: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#007AFF', 
    marginTop: 4 
  },
  cardClick: {
    fontSize: 14,
    color: 'black',
    fontWeight: 'bold',
    marginTop: 4,
  },

  // NAVIGATION
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
});

export default GlobalStyles;
