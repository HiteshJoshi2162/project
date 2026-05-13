const extractService = require('./extract.service');
const { validateUrl } = require('./validator');

// 🔥 URL CLEANER (IMPORTANT)
const cleanUrl = (url) => {
    if (!url) return "";
    let cleaned = url.trim();
    if (!cleaned.startsWith("http")) {
        cleaned = "https://" + cleaned;
    }
    // DO NOT split by "?" here, as Instagram URLs need their parameters
    return cleaned;
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

console.log("📥 Incoming URL:", url);

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
                setTimeout(() => reject(new Error("TIMEOUT")), 45000)
            )
        ]);

        if (!media || !media.downloadUrl) {
            console.error("❌ MEDIA NOT FOUND FOR URL:", url);
            throw new Error("NO_MEDIA_FOUND");
        }

        const result = {
            status: 'success',
            media: [
                {
                    type: media.isVideo ? "video" : "image",
                    url: media.downloadUrl,
                    thumbnail: media.thumbnailUrl // Add thumbnail here
                }
            ]
        };

        console.log("✅ Sending Success Response:", JSON.stringify(result));
        return res.status(200).json(result);

    } catch (error) {
        console.error("❌ ERROR DETAILS:", error);

        let message = error.message || "Something went wrong";

        if (error.message === "TIMEOUT") {
            message = "Server timeout, Instagram is taking too long to respond";
        } else if (error.message === "MEDIA_NOT_FOUND" || error.message === "NO_MEDIA_FOUND") {
            message = "Could not find any video or image in this link. Make sure the account is public.";
        } else if (error.message === "INVALID_URL") {
            message = "Please provide a valid Instagram link";
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
