# Firestore Security Specification & Invariants

## 1. Data Invariants
- **Crop Invariant**: A crop is owned by the user who created it (`userId == request.auth.uid`). Only the owner can delete or edit general properties of a crop.
- **Stock Counter Invariant**: Non-owners can only perform stock updates (decreasing stock when buying). They must never modify the owner's details, pricing, name, or metadata.
- **Transaction Invariant**: A transaction must record the authentic buyer's Firebase Auth UID. Transactions are immutable after creation and cannot be updated or deleted by clients.
- **Identity Integrity**: For both crops and transactions, the creator's UID field must be verified using `request.auth.uid`.

---

## 2. The "Dirty Dozen" Threat Payloads (Adversarial Scenarios)

1. **Privilege Escalation (Shadow Fields)**: Changing `userId` of a crop during update to hijack another user's crop.
2. **Infinite Stock Generation**: A buyer updating the crop's `stock` field to a higher value than what currently exists.
3. **Price Alteration**: A buyer updating the `priceSol` or `priceUsdc` field during check-out to buy a crop for free.
4. **ID Poisoning / Buffer Overflow**: Writing an ID string of 1MB length as the `cropId` or `transactionId` to exhaust memory / exploit parser limits.
5. **Unauthorized Crop Deletion**: Attempting to delete another user's crop.
6. **Email Spoofing (Verification Bypass)**: An unverified user attempting write operations.
7. **Identity Spoofing on Create**: Creating a crop with a fake `userId` different from the authenticated UID.
8. **Transaction Tempering**: Attempting to update a settled transaction's amount, status, or discount.
9. **Transaction Erasure**: Attempting to delete a transaction log to hide purchase activity.
10. **Query Scraping / Blanket Reads**: Querying the entire transactions collection without filtering by the user's `userId`.
11. **Malicious Image Payloads**: Putting a massive string or invalid data types into the `imageUrl` field.
12. **Negative Stock Allocation**: Setting `stock` to a negative integer to break purchase validation.

---

## 3. Abstract Test Cases for Verification

```ts
// firestore.rules.test.ts (Conceptual Test Runner Schema)
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

describe("Garden Security Rules", () => {
  // 1. Forbids unauthenticated users from creating crops
  it("rejects crop creation from logged-out users", async () => {
    await assertFails(db.collection('crops').add({ name: 'Tomate', priceSol: 0.1 }));
  });

  // 2. Requires email verification
  it("rejects crop updates from unverified users", async () => {
    await assertFails(db.collection('crops').add({ userId: 'u123', name: 'Papa' }));
  });

  // 3. Prevent self-assigned ownership
  it("rejects crop ownership spoofing", async () => {
    await assertFails(db.collection('crops').doc('c1').set({ userId: 'other-user', name: 'Zanahoria' }));
  });
});
```
