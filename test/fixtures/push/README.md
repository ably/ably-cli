# Push Notifications Test Fixtures

These are **FAKE test files** for testing the CLI's push configuration commands.
They contain fake/invalid credentials that won't work with real push services.

## Files

| File | Purpose | Used by |
|------|---------|---------|
| `test-fcm-service-account.json` | Firebase Cloud Messaging service account | `push config set-fcm` |
| `test-apns-key.p8` | APNs Token Auth signing key | `push config set-apns --p8-key` |
| `test-apns-cert.pem` | APNs Certificate Auth - PEM certificate | `push config set-apns --certificate` |
| `test-apns-private-key.pem` | APNs Certificate Auth - PEM private key | `push config set-apns --private-key` |

## Usage in Tests

These fixtures are used by unit tests to validate file parsing and command behavior
without making actual API calls. The Ably Control API validates credentials with
the push services (Google/Apple), so these fake credentials will be accepted by
the CLI but rejected by the API.

## Test Values

### FCM
- Project ID: `test-project-12345`
- Client Email: `firebase-adminsdk-test@test-project-12345.iam.gserviceaccount.com`

### APNs Token Auth
- Key ID: `ABC123DEFG`
- Team ID: `TEAM123456`
- Topic: `com.example.testapp`
