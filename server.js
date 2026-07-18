const mode = String(process.env.APP_MODE || "local").trim().toLowerCase();

if (mode === "hosted") {
  require("./src/hosted/server").start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  require("./src/local/server");
}
