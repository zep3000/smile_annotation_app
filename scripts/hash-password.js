const { hashPassword } = require("../src/hosted/auth");

async function main() {
  const password = process.argv[2] || process.env.PASSWORD_TO_HASH || "";
  if (password.length < 12) {
    throw new Error("Supply a password of at least 12 characters as an argument or PASSWORD_TO_HASH.");
  }
  console.log(await hashPassword(password));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
