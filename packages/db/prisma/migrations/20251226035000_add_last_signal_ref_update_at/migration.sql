-- Add last_signal_ref_update_at column for debouncing GitHub updates
ALTER TABLE "public"."hr_status" ADD COLUMN "last_signal_ref_update_at" TIMESTAMP;
