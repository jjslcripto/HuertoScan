# Security Specifications for Crop Ledger

## 1. Data Invariants
- A Crop must have a valid `userId` representing its owner, matching the authenticated user.
- No user can read, edit or delete another user's crops (unless marking isForSale which allows other users to view/list for purchase).
- A Crop must have realistic numerical ranges for stock, prices, and timestamp.
- Field types must strictly match standard specifications (strings for botanical fields, numbers for prices, isForSale as boolean).

## 2. Theoretical Exploit Payloads ("The Dirty Dozen")
1. **The Ghost Field (Shadow Update)**: Injecting `isVerifiedByAdmin: true` on edit.
2. **Identity Spoofing**: Attempting to upload a crop with another user's `userId` as owner.
3. **Price Poisoning**: Setting negative or extremely high float values for price or setting string value instead.
4. **Stock Poisoning**: Setting double, subzero, or non-integral numbers for stock levels.
5. **Timestamp Hijacking**: Setting a custom or future string as `scannedAt` instead of `request.time`.
6. **Description Flooding**: Uploading a 5MB base64 string as text fields (such as `uses` or `description`).
7. **Cross-User Injection**: Editing another user's private crop description when not the owner.
8. **Malicious ID Injection**: Creating a crop with an ID containing shell characters.
9. **Rogue Delete**: Discarding or deleting another user's crop.
10. **State Shortcutting**: Updating `isForSale` to bypass the inventory rules without stock or price verification.
11. **Anatomical Blanking**: Setting vital botanical parameters (like `raiz` or `clorofila`) to empty arrays or wrong types.
12. **PII Exfiltration**: Attempting a bulk list or wildcard query of private profiles of other growers.

## 3. Security Rules Draft Concept
Verify rules validate:
1. `request.auth != null`
2. `request.resource.data.userId == request.auth.uid`
3. All fields match their type specification and strict keys are matching.
