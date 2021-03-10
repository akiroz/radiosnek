const stream = require("stream");
const AlsaCapture = require("alsa-capture");
const Discord = require('discord.js');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const timeout = (ms) => new Promise(r => setTimeout(r, ms));
const chromeOpts = new chrome.Options().headless().windowSize({ width: 640, height: 480 });
const client = new Discord.Client();

client.login(process.env.TOKEN);

client.on("ready", () => {
    console.log("Discord ready");
    client.user.setStatus("idle");
});

const audioStream = new stream.PassThrough();
const alsaCapture = new AlsaCapture({
    channels: 2,
    format: "S16_LE",
    periodSize: 480,
    rate: 48000,
});
alsaCapture.on("audio", buf => audioStream.write(buf));

let currentSession = null;

async function spawnDriver(channel) {
    console.log("Request channel:", channel);
    const driver = new webdriver.Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOpts)
        .build();
    currentSession = driver;
    client.user.setStatus("dnd");
    const url = `https://radiko.jp/#!/live/${channel}`;
    await driver.get(url);
    console.log("Connected", url);
    const playBtn = await driver.wait(webdriver.until.elementLocated(webdriver.By.css("a.play-radio")), 30000);
    console.log("Play button loaded");
    await playBtn.click();
    client.user.setStatus("online");
    return driver;
}

async function cleanup() {
    if(!currentSession) return;
    console.log("Cleanup");
    await currentSession.quit();
    currentSession = null;
    client.user.setStatus("idle");
}

client.on('message', async (message) => {
    if (!message.guild) return;

    if (message.content?.startsWith("/stream")) {
        if (!message.content?.startsWith("/stream")) return;
        if (!message.member.voice.channel) return;

        const [_, radioChannel] = message.content.split(" ");
        if (radioChannel.length < 1) return;

        await cleanup();
        await spawnDriver(radioChannel);
        const connection = await message.member.voice.channel.join();
        console.log("Voice joined:", message.member.voice.channel.name);
        connection.once("disconnect", () => cleanup());
        connection.once("failed", () => cleanup());
        connection.play(audioStream, { type: "converted", bitrate: "auto" });
    }
    
    if (message.content?.startsWith("/stop")) {
        cleanup();
    }

});
