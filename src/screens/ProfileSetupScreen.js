// ProfileSetupScreen.js – fully revised to ensure reliable saving and preserve accountType
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, 
  Image, Alert, Animated, Dimensions, BackHandler
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getAuthInstance } from '../config/firebaseConfig';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, storage } from '../config/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../styles/theme';
import { createProfileSetupScreenStyles } from '../styles/ProfileSetupScreenStyles';

const INTERESTS = [
  { name: 'Sports', icon: 'football-outline' }, 
  { name: 'Stand Up', icon: 'mic-outline' },
  { name: 'Cinema', icon: 'film-outline' },
  { name: 'Sci-Fi', icon: 'planet-outline' },
  { name: 'Board Games', icon: 'dice-outline' },
  { name: 'Hiking', icon: 'walk-outline' },
  { name: 'Art', icon: 'color-palette-outline' },
  { name: 'Live Music', icon: 'musical-notes-outline' },
];

export default function ProfileSetupScreen({ navigation }) {
  const theme = useTheme();
  const styles = useMemo(() => createProfileSetupScreenStyles(theme), [theme]);

  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [age, setAge] = useState('');
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [imageSheetVisible, setImageSheetVisible] = useState(false);
  const [triggerSaveOnBack, setTriggerSaveOnBack] = useState(false);

  const screenHeight = Dimensions.get('window').height;
  const [sheetAnim] = useState(new Animated.Value(screenHeight));

  useEffect(() => {
    const init = async () => {
      const auth = await getAuthInstance();
      if (!auth?.currentUser) {
        navigation.replace('LoginScreen');
        return;
      }

      const currentUser = auth.currentUser;
      setUser(currentUser);
      setName(currentUser.displayName || '');
      setEmail(currentUser.email || '');
      setProfileImage(currentUser.photoURL || '');
      fetchUserData(currentUser.uid);
    };

    init();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Save Changes?', 'Do you want to save your changes before leaving?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save & Exit', onPress: () => setTriggerSaveOnBack(true) }
      ]);
      return true;
    });

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (triggerSaveOnBack) {
      setTriggerSaveOnBack(false);
      handleSaveAndBack();
    }
  }, [triggerSaveOnBack]);

  const fetchUserData = async (uid) => {
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.age) setAge(data.age);
        if (data.interests) setInterests(data.interests);
        if (data.photoURL) setProfileImage(data.photoURL);
      }
    } catch (e) {
      console.warn('Failed to fetch profile data:', e);
    }
  };

  const toggleInterest = (interest) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  useEffect(() => {
    const requestPermissions = async () => {
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();

      if (mediaStatus !== 'granted' || cameraStatus !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera and gallery permissions.');
      } else {
        setPermissionsGranted(true);
      }
    };
    requestPermissions();
  }, []);

  const handleChooseImage = () => {
    setImageSheetVisible(true);
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleCloseSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: screenHeight,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setImageSheetVisible(false));
  };

  const handleChoosePhoto = async () => {
    handleCloseSheet();
    if (!permissionsGranted) {
      Alert.alert('Permission Required', 'You need to enable gallery permissions.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result || result.canceled || !result.assets || !result.assets[0]?.uri) return;

    setProfileImage(result.assets[0].uri);
  };

  const handleTakePhoto = async () => {
    handleCloseSheet();
    if (!permissionsGranted) {
      Alert.alert('Permission Required', 'You need to enable camera permissions.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      cameraType: 'front',
    });

    if (!result || result.canceled || !result.assets || !result.assets[0]?.uri) return;

    setProfileImage(result.assets[0].uri);
  };

  const uploadProfileImage = async (uri, uid) => {
    try {
      if (uri.startsWith('content://')) {
        const fileName = `${uid}_${Date.now()}.jpg`;
        const dest = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
      }

      const response = await fetch(uri);
      const blob = await response.blob();

      const imageRef = ref(storage, `profilePhotos/${uid}.jpg`);
      await uploadBytes(imageRef, blob);
      return await getDownloadURL(imageRef);
    } catch (e) {
      console.error('❌ Image upload failed:', e.message || e);
      return null;
    }
  };

  const handleSaveAndBack = async () => {
    const auth = await getAuthInstance();
    if (!auth?.currentUser || !name.trim() || !age.trim()) {
      navigation.goBack();
      return;
    }

    setLoading(true);
    try {
      let photoURL = profileImage;

      if (profileImage && (profileImage.startsWith('file://') || profileImage.startsWith('content://'))) {
        console.log('📸 Uploading new profile photo...');
        const uploaded = await uploadProfileImage(profileImage, auth.currentUser.uid);
        if (uploaded) {
          photoURL = uploaded;
          setProfileImage(photoURL);
        } else {
          console.warn('⚠️ Failed to upload image. Keeping old URL.');
        }
      }

      await updateProfile(auth.currentUser, {
        displayName: name,
        photoURL,
      });

      const userRef = doc(db, 'users', auth.currentUser.uid);
      const existing = await getDoc(userRef);
      const existingAccountType = existing?.data()?.accountType || 'free';

      await setDoc(userRef, {
        name,
        email,
        age,
        interests,
        photoURL,
        accountType: existingAccountType,
      }, { merge: true });

      console.log('✅ Profile saved to Firestore.');

    } catch (error) {
      console.error('🚨 Profile update failed:', error);
    } finally {
      setLoading(false);
      navigation.goBack();
    }
  };

  return (
    <View style={styles.profileContainer}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={handleSaveAndBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.profileTitle}>Profile Setup</Text>
        <View style={{ width: 24 }} />
      </View>

      <TouchableOpacity onPress={handleChooseImage} style={styles.imagePicker}>
        <Image 
          source={profileImage ? { uri: profileImage } : require('../../assets/default-avatar.png')} 
          style={styles.profileImage} 
        />
      </TouchableOpacity>

      <TextInput 
        style={styles.input} 
        placeholder="Name" 
        placeholderTextColor={theme.text} 
        value={name} 
        onChangeText={setName} 
      />

      <TextInput 
        style={styles.profileInput} 
        placeholder="Email" 
        placeholderTextColor={theme.text} 
        value={email} 
        editable={false} 
      />

      <TextInput 
        style={styles.input} 
        placeholder="Age" 
        placeholderTextColor={theme.text} 
        value={age} 
        onChangeText={setAge} 
        keyboardType="numeric" 
      />

      <Text style={styles.sectionTitle}>Select Interests</Text>
      <View style={styles.interestsGrid}>
        {INTERESTS.map(({ name, icon }) => (
          <TouchableOpacity
            key={name}
            style={[styles.interestItem, interests.includes(name) && styles.selectedInterest]}
            onPress={() => toggleInterest(name)}
          >
            <Ionicons name={icon} size={22} color={interests.includes(name) ? theme.primary : theme.icon} />
            <Text style={[styles.interestLabel, { color: theme.text }]}>{name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {imageSheetVisible && (
        <>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)'
            }}
            onPress={handleCloseSheet}
          />
          <Animated.View
            style={{
              transform: [{ translateY: sheetAnim }],
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: theme.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowOffset: { width: 0, height: -2 },
              shadowRadius: 10,
            }}
          >
            <TouchableOpacity onPress={handleTakePhoto} style={{ padding: 15, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="camera-outline" size={20} color={theme.text} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, color: theme.text }}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleChoosePhoto} style={{ padding: 15, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="images-outline" size={20} color={theme.text} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, color: theme.text }}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCloseSheet} style={{ padding: 15, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="close-outline" size={20} color="red" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, color: 'red' }}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  );
}
