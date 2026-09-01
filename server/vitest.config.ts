import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      LOTTERY_SKIP_PRIZE_SEED: "1",
      LOTTERY_SKIP_PARTICIPANT_SEED: "1",
    },
  },
});
