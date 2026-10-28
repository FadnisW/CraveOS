-- Phase 5 pricing correctness: preserve the exact variant/add-on selection on
-- every order line. Without this the kitchen ticket and the customer's receipt
-- cannot show which size or extras were paid for.

ALTER TABLE "order_items" ADD COLUMN "optionsSnapshot" JSONB;
