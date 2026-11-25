# Firestore Security Specification

## 1. Data Invariants
1. Every `users/{uid}` document can only be read by its owner (`uid == request.auth.uid`) or a verified administrator (`isAdmin()`).
2. Newly created `users/{uid}` documents MUST have `role == 'user'` and `accountStatus == 'active'`; self-elevation to `admin` or `super_admin` on registration or profile update is strictly denied.
3. Every `projects/{projectId}` document belongs to a single `ownerUid == request.auth.uid`, which is immutable after creation.
4. Every `notifications/{notificationId}` document is readable only by its `uid` owner or an admin, and users can only mutate the `read` boolean flag.
5. Every `activity_logs/{activityId}` document is append-only (`update` and `delete` denied for non-admins) and must match `uid == request.auth.uid` on creation.
6. All `system_settings/{settingId}` and `admins/{uid}` mutations are strictly restricted to verified administrators.
7. Every write operation enforces `request.auth.token.email_verified == true`, strict key allowlists (`hasAll`/`hasOnly`), field size bounds, `isValidId()`, and server timestamp (`request.time`) integrity.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Privilege Escalation on Signup**: `users/u1` create with `{ uid: 'u1', role: 'admin', accountStatus: 'active', ... }`.
2. **Role Mutation on Profile Update**: `users/u1` update changing `role: 'super_admin'`.
3. **Account Suspension Bypass**: `users/u1` update changing `accountStatus: 'active'` when suspended.
4. **Shadow Field Injection**: `users/u1` create or update including undocumented key `isVerifiedAdmin: true`.
5. **Cross-User PII Read**: Authenticated `u2` attempting `get` on `users/u1`.
6. **Blanket User List Scrape**: Non-admin `u1` attempting `list` on `/users`.
7. **Unverified Email Spoof**: User with `email: 'dolimondal9903@gmail.com'` and `email_verified: false` attempting admin read/write.
8. **Project Ownership Spoofing**: User `u1` creating `projects/p1` with `ownerUid: 'u2'`.
9. **Immutable Timestamp Forgery**: User `u1` creating `projects/p1` with client-forged `createdAt` not equal to `request.time`.
10. **ID Poisoning**: Creating `projects/<1500-char-invalid-id>` or `projects/bad$id`.
11. **Non-Owner Project Read/Query**: User `u2` attempting `list` on `/projects` without `where('ownerUid', '==', 'u2')`.
12. **Unauthorized System Setting Tampering**: Normal user `u1` updating `system_settings/global` (`maxUploadSizeMb: 99999`).
