// ProfileScreenStyles.js - dark mode compatible
import { StyleSheet } from 'react-native';

export const createProfileScreenStyles = (theme) => StyleSheet.create({
  profilecontainer: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: 15,
    position: 'relative',
  },
  profileInnerContent: {
    paddingHorizontal: 20,
    flex: 1,
  },
  savedtitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.text,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarRowLeftAligned: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  smallAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  nameSection: {
    flex: 1,
    justifyContent: 'center',
  },
  profilename: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  profileemail: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 20,
  },
  profilemodifyButtonMini: {
    backgroundColor: theme.greybutton,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  profilebuttonText: {
    color: theme.text,
    fontWeight: 'bold',
    fontSize: 14,
  },
  subscriptionContainer: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginTop: 15,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  planLabel: {
    fontSize: 16,
    color: theme.text,
  },
  planBadge: {
    backgroundColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  planBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
  },
  benefitList: {
    marginTop: 8,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    color: theme.text,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  benefitText: {
    fontSize: 15,
    color: theme.text,
    marginLeft: 6,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 16,
  },
  premiumButton: {
    marginTop: 20,
    backgroundColor: theme.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  premiumButtonText: {
    fontWeight: 'bold',
    color: theme.background,
    fontSize: 16,
  },
  guestProfileContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    paddingTop: -50,
  },
  
  guestProfileText: {
    color: theme.guestBannerText,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 18,
  },
  guestProfileLink: {
    color: theme.primary,
    textDecorationLine: 'underline',
    fontWeight: 'bold',
  },
  signupButton: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 10,
  },
  signupButtonText: {
    color: theme.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  bottomNavWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.background,
    elevation: 10,
    shadowColor: theme.shadow || '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 4,
    alignItems: 'center',
    paddingBottom: 16,
    paddingTop: 12,
  },
});
