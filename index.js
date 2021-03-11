const stream = require("stream");
const AlsaCapture = require("alsa-capture");
const Discord = require('discord.js');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const { ALOOP, TOKEN, COMMAND } = process.env;

const timeout = (ms) => new Promise(r => setTimeout(r, ms));
const chromeOpts = new chrome.Options().headless().addArguments(`remote-debugging-port=922${ALOOP}`, `alsa-output-device=hw:0,0,${ALOOP}`);
const client = new Discord.Client();

client.login(TOKEN);

client.on("ready", () => {
    console.log("Discord ready");
    client.user.setStatus("idle");
});

let audioStream = null;
const alsaCapture = new AlsaCapture({
    debug: true,
    channels: 2,
    device: `hw:0,1,${process.env.ALOOP}`,
    format: "S16_LE",
    periodSize: 256,
    rate: 48000,
});
alsaCapture.on("audio", buf => {
    if(audioStream && audioStream.writable) {
        audioStream.write(buf);
    }
});

let currentSession = null;
let voiceConnection = null;

async function spawnDriver(channel) {
    console.log("Request channel:", channel);
    const driver = new webdriver.Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOpts)
        .build();
    currentSession = driver;
    client.user.setStatus("dnd");
    
    if(channel === "AG+") {
        const url = "https://www.uniqueradio.jp/agplayer5/inc-player-hls.php";
        await driver.get(url);
        console.log("Driver: connected", url);
        const playBtn = await driver.wait(webdriver.until.elementLocated(webdriver.By.css("button.vjs-big-play-button")), 30000);
        await playBtn.click();
        console.log("Driver: play clicked");
    } else {
        const url = `https://radiko.jp/#!/live/${channel}`;
        await driver.get(url);
        console.log("Driver: connected", url);
        await driver.wait(webdriver.until.elementLocated(webdriver.By.css("button.js-policy-accept")), 30000);
        await driver.executeScript("document.getElementById('colorbox').remove()");
        await driver.executeScript("document.getElementById('cboxOverlay').remove()");
        console.log("Driver: overlay removed");
        const playBtn = await driver.wait(webdriver.until.elementLocated(webdriver.By.css("a.play-radio")), 5000);
        await playBtn.click();
        console.log("Driver: play clicked");
    }
    
    client.user.setStatus("online");
    return driver;
}

async function cleanup() {
    console.log("Cleanup");
    if(voiceConnection) {
        voiceConnection.disconnect();
        voiceConnection = null;
    }
    if(currentSession) {
        const session = currentSession;
        currentSession = null;
        await session.quit();
    }
    if(audioStream) {
        audioStream.end();
        audioStream = null;
    }
    client.user.setStatus("idle");
}

client.on('message', async (message) => {
    if (!message.guild) return;
    if (message.channel.name !== COMMAND) return;

    if (message.content?.startsWith("/radio-stream")) {
        if (!message.member.voice.channel) return;

        const [_, radioChannel] = message.content.split(" ");
        if (radioChannel.length < 1) return;

        await cleanup();
        await spawnDriver(radioChannel);
        voiceConnection = await message.member.voice.channel.join();
        console.log("Voice joined:", message.member.voice.channel.name);
        voiceConnection.once("disconnect", () => cleanup());
        voiceConnection.once("failed", () => cleanup());
        audioStream = new stream.PassThrough();
        voiceConnection.play(audioStream, { type: "converted", bitrate: "auto" });
    }

    if (message.content?.startsWith("/radio-kill")) {
        cleanup();
    }

});
