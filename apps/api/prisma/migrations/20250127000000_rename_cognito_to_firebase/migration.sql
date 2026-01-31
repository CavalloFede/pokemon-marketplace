-- AlterTable: Rename cognito_id to firebase_uid
ALTER TABLE "users" RENAME COLUMN "cognito_id" TO "firebase_uid";
