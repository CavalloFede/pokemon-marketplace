-- CreateTable
CREATE TABLE "counter_offer_offered_pokemon" (
    "id" TEXT NOT NULL,
    "counter_offer_id" TEXT NOT NULL,
    "pokemon_id" TEXT NOT NULL,

    CONSTRAINT "counter_offer_offered_pokemon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "counter_offer_offered_pokemon_counter_offer_id_pokemon_id_key" ON "counter_offer_offered_pokemon"("counter_offer_id", "pokemon_id");

-- AddForeignKey
ALTER TABLE "counter_offer_offered_pokemon" ADD CONSTRAINT "counter_offer_offered_pokemon_counter_offer_id_fkey" FOREIGN KEY ("counter_offer_id") REFERENCES "counter_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_offer_offered_pokemon" ADD CONSTRAINT "counter_offer_offered_pokemon_pokemon_id_fkey" FOREIGN KEY ("pokemon_id") REFERENCES "user_pokemon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing data: copy offeredPokemonId into the new join table
INSERT INTO "counter_offer_offered_pokemon" ("id", "counter_offer_id", "pokemon_id")
SELECT gen_random_uuid(), "id", "offered_pokemon_id"
FROM "counter_offers"
WHERE "offered_pokemon_id" IS NOT NULL;

-- AlterTable: make offeredPokemonId nullable
ALTER TABLE "counter_offers" ALTER COLUMN "offered_pokemon_id" DROP NOT NULL;
