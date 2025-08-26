// ProfileSetupScreenStyles.js - dark mode compatible
import { StyleSheet } from 'react-native';

export const createProfileSetupScreenStyles = (theme) => StyleSheet.create({
  profileContainer: {
    flex: 1,
    paddingTop: 15,
    paddingHorizontal: 20,
    backgroundColor: theme.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 0,
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
  },
  imagePicker: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  input: {
    backgroundColor: theme.card,
    color: theme.text,
    padding: 12,
    marginBottom: 14,
    borderRadius: 8,
    fontSize: 16,
  },
  profileInput: {
    backgroundColor: theme.card,
    color: theme.text,
    padding: 12,
    marginBottom: 14,
    borderRadius: 8,
    fontSize: 16,
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  interestItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    backgroundColor: theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedInterest: {
    borderColor: theme.primary,
    backgroundColor: theme.banner,
  },
  interestLabel: {
    fontSize: 14,
    marginLeft: 8,
  },
});
