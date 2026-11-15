-- Create Message table for messaging functionality
CREATE TABLE "Message" (
    "messageID" VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderID" VARCHAR(255) NOT NULL,
    "senderType" VARCHAR(50) NOT NULL CHECK ("senderType" IN ('delegate', 'chair')),
    "senderName" VARCHAR(255) NOT NULL,
    "receiverID" VARCHAR(255) NOT NULL,
    "receiverType" VARCHAR(50) NOT NULL CHECK ("receiverType" IN ('delegate', 'chair')),
    "receiverName" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "read" BOOLEAN DEFAULT FALSE,
    "committeeID" VARCHAR(255),
    
    -- Add foreign key constraints if needed
    FOREIGN KEY ("committeeID") REFERENCES "Committee"("committeeID") ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_message_sender ON "Message"("senderID");
CREATE INDEX idx_message_receiver ON "Message"("receiverID");
CREATE INDEX idx_message_conversation ON "Message"("senderID", "receiverID");
CREATE INDEX idx_message_committee ON "Message"("committeeID");
CREATE INDEX idx_message_timestamp ON "Message"("timestamp");
CREATE INDEX idx_message_unread ON "Message"("receiverID", "read") WHERE "read" = FALSE;