import { Bot } from "grammy";
import { spawn } from "child_process";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("Missing BOT_TOKEN env var");
  process.exit(1);
}

const bot = new Bot(token);

bot.command("start", (ctx) =>
  ctx.reply("Welcome! Send /hi or /create_multisig")
);

bot.command("hi", (ctx) => ctx.reply("Hi!"));

bot.command("create_multisig", async (ctx) => {
  await ctx.reply("Creating Squads multisig on devnet...");

  const child = spawn("tsx", ["./create_multisig.ts"], {
    env: process.env,
  });

  let out = "";
  let err = "";

  child.stdout.on("data", (d) => (out += d.toString()));
  child.stderr.on("data", (d) => (err += d.toString()));

  child.on("close", async () => {
    if (err) {
      await ctx.reply("❌ Error: " + err.slice(0, 1500));
      return;
    }

    try {
      const res = JSON.parse(out);
      if (res.ok) {
        await ctx.reply(
          `✅ Multisig created!\n\n` +
            `🔑 Multisig PDA: ${res.multisigPda}\n` +
            `👤 Creator: ${res.creator}\n` +
            `👥 Member 2: ${res.member2}\n` +
            `📝 TX: ${res.tx}`
        );
      } else {
        await ctx.reply("❌ Failed: " + res.error);
      }
    } catch (e) {
      await ctx.reply("❌ Could not parse result");
    }
  });
});

bot.start();
console.log("Bot started. Press Ctrl+C to stop.");
