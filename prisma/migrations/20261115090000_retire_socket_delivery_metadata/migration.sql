-- Retire ephemeral connection exclusion; keep all durable intents and their state.
ALTER TABLE public."MessageDelivery" DROP COLUMN "excludedSocketId";
