/** "firebase/analytics" əvəzi: öz serverimizdə Google Analytics yoxdur (Umami ayrıca qoşulur). */
export const isSupported = async () => false
export const getAnalytics = (_app?: unknown) => ({})
export const logEvent = (..._a: unknown[]) => {}
