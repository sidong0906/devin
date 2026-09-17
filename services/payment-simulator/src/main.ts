// OWNED BY: backend session. Entry point for @tools/payment-simulator.
import { buildSimulator } from "./app.js";

const app = buildSimulator();
const port = Number(process.env.PAYMENT_SIMULATOR_PORT ?? 4100);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
