# Access Manager — App Movil

Aplicacion movil para staff de control de acceso. Escaneo de QR, gestion de eventos y perfiles.

## Stack
- React Native 0.81 + Expo SDK 54
- expo-camera (escaneo QR)
- expo-secure-store (JWT almacenado de forma segura)
- React Navigation (native-stack)
- Axios (HTTP client)

## Configuracion

```bash
cp .env.example .env
# En dev: EXPO_PUBLIC_API_URL=http://TU_IP_LOCAL:8080
# En prod: EXPO_PUBLIC_API_URL=https://tu-api.onrender.com

npm install
npx expo start
```

> **Nota:** En desarrollo local la IP del servidor debe ser la IP LAN del ordenador
> (no localhost), ya que el dispositivo fisico accede por red local.

## Variables de entorno

| Variable | Descripcion |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | URL base del backend (sin barra final) |

## Generar APK (produccion)

Con EAS Build (recomendado):

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile production
```

Esto genera un `.apk` descargable desde el dashboard de Expo.

## Generar APK (local, sin EAS)

```bash
# Primero: instalar prebuild nativo
npx expo prebuild --platform android

# Luego compilar con Gradle
cd android && ./gradlew assembleRelease
# El APK estara en android/app/build/outputs/apk/release/
```

## Arquitectura

- `authStore.tsx` — Zustand store con JWT + perfiles del owner
- `apiClient.ts` — Axios con interceptor que inyecta `Authorization` y `X-Profile-Id`
- `SecureStore` — Almacena `auth_token` y `active_profile_id`
