// styles/theme.js
import React from 'react';
import { useColorScheme } from 'react-native';

export const lightTheme = {
  background: '#ffffff',
  text: '#000000',
  primary: '#3786c4',
  banner: '#FFFBEE',
  card: '#F8F8F8',
  setbutton: '#e2e2e2',
  border: '#ededed',
  setborder: '#bcbcbc',
  icon: '#333',
  iconActive: '#000',
  button: '#007AFF',
  greybutton: '#e3e3e3',
  guestBannerText: '#555',
  success: '#50a165',
};

export const darkTheme = {
  background: '#121212',
  text: '#ffffff',
  primary: '#0A84FF',
  banner: '#1E1E1E',
  card: '#1E1E1E',
  setbutton: '#1E1E1E',
  border: '#333',
  setborder: '#333',
  icon: '#ccc',
  iconActive: '#fff',
  button: '#0A84FF',
  greybutton: '#363636',
  guestBannerText: '#ccc',
  greenbutton: '#169156',
  success: '#50a165',
};

export const useTheme = () => {
  const { theme } = React.useContext(require('../context/ThemeContext').ThemeContext);
  return theme;
};
