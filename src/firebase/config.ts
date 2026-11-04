import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Firebase web konfiqurasiyası gizli deyil (brauzerə onsuz da göndərilir; təhlükəsizliyi Security Rules təmin edir).
// Env dəyişənləri təyin olunubsa, onlar üstünlük alır; yoxdursa, aşağıdakı standart dəyərlər işlənir.
const DEFAULTS = {
  apiKey: 'AIzaSyB3alay5Ai52FrNOPpyVyFgHG5Qapvgwcs',
  authDomain: 'birsual.firebaseapp.com',
  projectId: 'birsual',
  storageBucket: 'birsual.firebasestorage.app',
  messagingSenderId: '31059802078',
  appId: '1:31059802078:web:03428444b45eac9a714f4f',
  measurementId: 'G-PDCNXPQH5D',
}
const env = import.meta.env
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || DEFAULTS.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULTS.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || DEFAULTS.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULTS.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULTS.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || DEFAULTS.appId,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || DEFAULTS.measurementId,
}

export const firebaseConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId

export const app = initializeApp(firebaseConfigured ? firebaseConfig : { apiKey: 'missing', projectId: 'missing', appId: 'missing' })
export const auth = getAuth(app)

let cache
try {
  cache = persistentLocalCache({ tabManager: persistentMultipleTabManager() })
} catch {
  cache = undefined
}
export const db = initializeFirestore(app, cache ? { localCache: cache, ignoreUndefinedProperties: true } : { ignoreUndefinedProperties: true })
