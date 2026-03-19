import "dotenv/config";

import app from "./app.js";
import { getEnv } from "./config/env.js";

const { PORT } = getEnv();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
