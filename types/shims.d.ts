// expo-sqlite is an optional peer used only by createExpoAdapter(). It's not a
// dependency of this backend package, so we declare a minimal module shim to
// keep `tsc` happy. In the actual app (Expo), the real types take over.
declare module 'expo-sqlite'
