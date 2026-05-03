const extractService = require('./extract.service');
const { validateUrl } = require('./validator');

// 🔥 URL CLEANER (IMPORTANT)
const cleanUrl = (url) => {
    return url.split("?")[0];
};

const processExtraction = async (url, res) => {
    try {
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'Instagram URL is required'
            });
        }

        // ✅ Clean URL
        url = cleanUrl(url);

        if (!validateUrl(url)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid Instagram URL'
            });
        }

        console.log("📥 Processing URL:", url);

        // 🔥 Timeout safety
        const media = await Promise.race([
            extractService.getMediaMetadata(url),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("TIMEOUT")), 20000)
            )
        ]);

        if (!media || !media.downloadUrl) {
            throw new Error("NO_MEDIA_FOUND");
        }

        return res.status(200).json({
            status: 'success',
            media: {
                downloadUrl: media.downloadUrl,
                thumbnailUrl: media.thumbnailUrl,
                isVideo: media.isVideo,
                title: media.caption || "Instagram Media"
            }
        });

    } catch (error) {
        console.error("❌ ERROR:", error.message);

        let message = "Something went wrong";

        if (error.message === "TIMEOUT") {
            message = "Server timeout, try again";
        } else if (error.message === "NO_MEDIA_FOUND") {
            message = "Media not found";
        } else if (error.message.includes("blocked")) {
            message = "Instagram blocked request";
        }

        return res.status(500).json({
            status: 'error',
            message
        });
    }
};

const extractMedia = async (req, res) => {
    await processExtraction(req.body.url, res);
};

const downloadMedia = async (req, res) => {
    await processExtraction(req.query.url, res);
};

module.exports = { extractMedia, downloadMedia };
