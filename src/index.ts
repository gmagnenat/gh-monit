import { Command } from "commander";
import { registerDashboardCommand } from "./cli/dashboard.js";
import { registerDependabotCommand } from "./cli/dependabot.js";

const program = new Command();

program
  .name("gh-monit")
  .description("Fetch Dependabot alerts per repository")
  .version("0.1.0");

registerDependabotCommand(program);
registerDashboardCommand(program);

program.parseAsync(process.argv).catch((error: Error) => {
  console.error("Unexpected error:", error.message);
  process.exitCode = 1;
});
