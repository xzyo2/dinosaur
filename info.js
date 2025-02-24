// Replace with your Discord Webhook URL
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1343601327468445800/1goSa5Bbkeujrk80RKF7QxrkR2RhjDNV9popOI_5pulLZEwsLFvfjEeO9rCBnj0eXz6z";
const RATE_LIMIT_TIME = 120000; // 2 minutes in milliseconds

// Prevent duplicate execution
let alreadyExecuted = false;

// Function to get visitor IP and location using ipinfo.io
async function getLocation() {
    try {
        let response = await fetch("https://ipinfo.io/json?token=f567090226d20e");
        let data = await response.json();
        let [lat, lon] = data.loc ? data.loc.split(",") : ["Unknown", "Unknown"];

        return {
            ip: data.ip || "Unknown",
            city: data.city || "Unknown",
            region: data.region || "Unknown",
            country: data.country || "Unknown",
            zip: data.postal || "Unknown",
            isp: data.org || "Unknown",
            lat,
            lon
        };
    } catch (error) {
        console.error("Error fetching location:", error);
        return { ip: "Unknown", city: "Unknown", region: "Unknown", country: "Unknown", zip: "Unknown", isp: "Unknown", lat: "Unknown", lon: "Unknown" };
    }
}

// Function to check if data should be sent (prevents duplicate sends + rate limit)
function shouldSend(info) {
    let storedInfo = localStorage.getItem("visitor_info");
    let lastSentTime = parseInt(localStorage.getItem("last_sent_time") || "0", 10);
    let newInfoStr = JSON.stringify(info);
    let now = Date.now();

    // Rate limit: Only send if 2 minutes have passed
    if (now - lastSentTime < RATE_LIMIT_TIME) {
        console.log("⏳ Rate limit active, skipping send.");
        return false;
    }

    // Prevent duplicate sends of the same visitor info
    if (storedInfo === newInfoStr) {
        console.log("⏳ Same visitor info detected, not sending.");
        return false;
    }

    localStorage.setItem("visitor_info", newInfoStr);
    localStorage.setItem("last_sent_time", now.toString());
    return true;
}

// Function to collect visitor data and send to Discord
async function collectVisitorInfo() {
    if (alreadyExecuted) return; // Prevent duplicate execution
    alreadyExecuted = true; // Set flag to avoid double execution

    let location = await getLocation();
    let userAgent = navigator.userAgent;
    let platform = navigator.platform;
    let screenWidth = screen.width;
    let screenHeight = screen.height;
    let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let referrer = document.referrer || "Direct Visit";
    let currentPage = window.location.href;
    let language = navigator.language || "Unknown";
    let hasTouchScreen = "ontouchstart" in document.documentElement ? "Yes" : "No";

    let visitorInfo = {
        ip: location.ip,
        city: location.city,
        region: location.region,
        country: location.country,
        zip: location.zip,
        isp: location.isp,
        lat: location.lat,
        lon: location.lon,
        userAgent,
        platform,
        screenWidth,
        screenHeight,
        timezone,
        referrer,
        currentPage,
        language,
        hasTouchScreen
    };

    if (!shouldSend(visitorInfo)) return;

    let message = {
        content: "**🌍 New Visitor Alert!**",
        embeds: [
            {
                title: "Visitor Information",
                color: 16711680,
                fields: [
                    { name: "📍 IP Address", value: `\`${location.ip}\``, inline: false },
                    { name: "🏙 City", value: `\`${location.city}\``, inline: true },
                    { name: "🌍 Region", value: `\`${location.region}\``, inline: true },
                    { name: "🌎 Country", value: `\`${location.country}\``, inline: false },
                    { name: "📮 ZIP Code", value: `\`${location.zip}\``, inline: true },
                    { name: "📡 ISP", value: `\`${location.isp}\``, inline: false },
                    { name: "🗺 Coordinates", value: `Lat: \`${location.lat}\`, Lon: \`${location.lon}\``, inline: false },
                    { name: "🖥 Browser & OS", value: `\`${userAgent}\``, inline: false },
                    { name: "💻 Platform", value: `\`${platform}\``, inline: true },
                    { name: "📏 Screen Size", value: `\`${screenWidth}x${screenHeight}\``, inline: true },
                    { name: "🕰 Timezone", value: `\`${timezone}\``, inline: false },
                    { name: "🌐 Language", value: `\`${language}\``, inline: true },
                    { name: "🔗 Referrer", value: `\`${referrer}\``, inline: false },
                    { name: "📄 Page Visited", value: `\`${currentPage}\``, inline: false },
                    { name: "📱 Touchscreen", value: `\`${hasTouchScreen}\``, inline: true }
                ],
                footer: { text: "Visitor Tracking System" }
            }
        ]
    };

    fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
    }).catch(err => console.error("Error sending data:", err));
}

// Run function once per reload
window.addEventListener("load", () => {
    setTimeout(() => {
        if (!alreadyExecuted) {
            collectVisitorInfo();
        }
    }, 500); // Small delay to ensure execution
});
