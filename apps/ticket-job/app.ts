import cron from "node-cron";
import { pgClient } from "./db";

const MAX_AVAILABLE_TICKET = 4;

const EXPRESSION = "0 0,6,12,18 * * *";
const TEST = "* * * * *";

async function updateTickets(max: number) {
  try {
    await pgClient.query(
      `
      UPDATE db0.ingame
      SET available_ticket = available_ticket + 1
      WHERE available_ticket < $1
    `,
      [max]
    );

    console.log(`ticket-job success`);
  } catch (err) {
    console.error("ticket-job failed:", err);
  }
}

async function boot() {
  try {
    await pgClient.connect();
    console.log("postgresql connected...");

    cron.schedule(EXPRESSION, () => {
      console.log("running ticket-job...");
      updateTickets(MAX_AVAILABLE_TICKET);
    });
  } catch (err) {
    console.error("connection failed:", err);
  }
}

boot();
