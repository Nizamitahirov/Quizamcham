import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
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
