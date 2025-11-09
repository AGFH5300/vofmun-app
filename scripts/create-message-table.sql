-- Messaging schema reset for delegates and chairs
-- Run this in the Supabase SQL editor (PostgreSQL) to rebuild the message store.
-- NOTE: This will drop the existing Message table. Back up any data you need first.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS "Message" CASCADE;

CREATE TABLE "Message" (
    "messageID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderID" UUID NOT NULL,
    "senderType" TEXT NOT NULL CHECK ("senderType" IN ('delegate', 'chair')),
    "senderName" TEXT NOT NULL,
    "receiverID" UUID NOT NULL,
    "receiverType" TEXT NOT NULL CHECK ("receiverType" IN ('delegate', 'chair')),
    "receiverName" TEXT NOT NULL,
    "content" TEXT NOT NULL CHECK (char_length(trim(both FROM "content")) > 0),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "read" BOOLEAN NOT NULL DEFAULT FALSE,
    "committeeID" UUID,
    "conversationKey" TEXT GENERATED ALWAYS AS (
        CASE
            WHEN "senderID"::text < "receiverID"::text THEN "senderID"::text || '::' || "receiverID"::text
            ELSE "receiverID"::text || '::' || "senderID"::text
        END
    ) STORED,
    CONSTRAINT fk_message_committee
        FOREIGN KEY ("committeeID")
        REFERENCES "Committee"("committeeID")
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_message_sender ON "Message"("senderID");
CREATE INDEX idx_message_receiver ON "Message"("receiverID");
CREATE INDEX idx_message_conversation_key ON "Message"("conversationKey");
CREATE INDEX idx_message_timestamp ON "Message"("timestamp");
CREATE INDEX idx_message_unread ON "Message"("receiverID", "read") WHERE "read" = FALSE;

COMMENT ON TABLE "Message" IS 'Stores every delegate ↔ chair message scoped to a committee.';
COMMENT ON COLUMN "Message"."conversationKey" IS 'Deterministic participant pair key for fast conversation lookups.';
