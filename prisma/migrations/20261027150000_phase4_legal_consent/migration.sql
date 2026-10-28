-- Phase 4: record explicit consent to the Terms of Service and Privacy Policy.
--
-- Signup previously created an account on the first verified OTP with no
-- affirmative acceptance of any policy. These nullable columns let the API
-- record when the checkbox was ticked and which policy version was shown.
-- They stay nullable for pre-Phase-4 accounts; new accounts must supply
-- acceptance or the API refuses to create them.

ALTER TABLE "users"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyVersion" TEXT;
