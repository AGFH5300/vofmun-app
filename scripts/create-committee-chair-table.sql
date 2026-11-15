
-- Create Committee-Chair junction table
CREATE TABLE "Committee-Chair" (
    "chairID" VARCHAR(255) NOT NULL,
    "committeeID" VARCHAR(255) NOT NULL,
    PRIMARY KEY ("chairID", "committeeID"),
    FOREIGN KEY ("chairID") REFERENCES "Chair"("chairID") ON DELETE CASCADE,
    FOREIGN KEY ("committeeID") REFERENCES "Committee"("committeeID") ON DELETE CASCADE
);

-- Create index for better performance
CREATE INDEX idx_committee_chair_committee ON "Committee-Chair"("committeeID");
