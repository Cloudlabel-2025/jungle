import mongoose from "mongoose";
import { seed } from "../lib/seed.js";
try {
  await seed();
  console.log(
    "Seed complete: Titan Institute, Alpha Cohort, 5 squads, 29 personas, 30 quests.",
  );
} finally {
  await mongoose.disconnect();
}
