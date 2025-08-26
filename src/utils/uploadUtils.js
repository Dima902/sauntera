// uploadUtils.js
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebaseConfig';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Uploads an image to Firebase Storage with a unique filename and returns the download URL.
 * @param {string} uri - The local image URI from ImagePicker.
 * @param {string} uid - The user ID (used to namespace the file).
 * @returns {Promise<string>} - The download URL of the uploaded image.
 */
export const uploadImageToStorage = async (uri, uid) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    const uniquePath = `profileImages/${uid}_${Date.now()}.jpg`;
    const imageRef = ref(storage, uniquePath);
    await uploadBytes(imageRef, blob);
    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
  } catch (error) {
    console.error('❌ Failed to upload image:', error);
    throw error;
  }
};

/**
 * Deletes an image from Firebase Storage.
 * @param {string} path - The storage path, e.g., "profileImages/uid.jpg"
 * @returns {Promise<void>}
 */
export const deleteImageFromStorage = async (path) => {
  try {
    const imageRef = ref(storage, path);
    await deleteObject(imageRef);
    console.log(`✅ Image deleted from storage at path: ${path}`);
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      console.warn('⚠️ Image not found in storage:', path);
    } else {
      console.error('❌ Failed to delete image:', error);
    }
    throw error;
  }
};

/**
 * Compresses and resizes an image before upload.
 * @param {string} uri - The original image URI from ImagePicker.
 * @returns {Promise<string>} - Compressed image URI.
 */
export const compressImage = async (uri) => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (e) {
    console.warn('Compression failed:', e);
    return uri;
  }
};
