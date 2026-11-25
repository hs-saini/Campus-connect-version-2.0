const { hashPassword } = require("../lib/auth");

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Run this command in an interactive terminal so the password is not echoed."));
      return;
    }
    let value = "";
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    const finish = (error) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      const key = chunk.toString("utf8");
      if (key === "\u0003") return finish(new Error("Cancelled."));
      if (key === "\r" || key === "\n") return finish();
      if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
        return;
      }
      if (!/[\u0000-\u001f]/.test(key)) value += key;
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const password = await readHidden("Master admin password (minimum 10 characters): ");
  if (password.length < 10 || password.length > 128) {
    throw new Error("Password must be between 10 and 128 characters.");
  }
  process.stdout.write(`${await hashPassword(password)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
