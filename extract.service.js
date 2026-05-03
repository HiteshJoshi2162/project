const axios = require('axios');

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
    "Accept-Language": "en-US,en;q=0.9"
};

// 🔥 URL CLEANER
const cleanUrl = (url) => {
    return url.split("?")[0];
};

const tryAxios = async (url) => {
    url = cleanUrl(url);

    const res = await axios.get(url, {
        headers: HEADERS
    });

    const html = res.data;

    console.log("📄 HTML length:", html.length);

    // 🔥 Updated regex (working)
    const videoRegex = /"playback_url":"([^"]+)"/;
    const imageRegex = /"display_url":"([^"]+)"/;

    const videoMatch = html.match(videoRegex);
    if (videoMatch) {
        return {
            type: "video",
            downloadUrl: videoMatch[1].replace(/\\u0026/g, '&'),
            thumbnailUrl: videoMatch[1],
            isVideo: true,
            caption: "Instagram Reel"
        };
    }

    const imageMatch = html.match(imageRegex);
    if (imageMatch) {
        return {
            type: "image",
            downloadUrl: imageMatch[1].replace(/\\u0026/g, '&'),
            thumbnailUrl: imageMatch[1],
            isVideo: false,
            caption: "Instagram Post"
        };
    }

    throw new Error("AXIOS_FAILED");
};

// 🔥 MAIN FUNCTION (NO PUPPETEER)
const getMediaMetadata = async (url) => {
    try {
        console.log("⚡ Using Axios scraping");
        return await tryAxios(url);
    } catch (e) {
        console.log("❌ Axios failed:", e.message);
        throw new Error("MEDIA_NOT_FOUND");
    }
};

module.exports = { getMediaMetadata };
