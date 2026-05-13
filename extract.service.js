const axios = require("axios");
const cheerio = require("cheerio");

const getMediaMetadata = async (url) => {
    try {
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const $ = cheerio.load(data);

        let video = $('meta[property="og:video"]').attr("content");
        let image = $('meta[property="og:image"]').attr("content");

        if (video) {
            return {
                isVideo: true,
                downloadUrl: video,
                thumbnailUrl: image || video
            };
        }

        if (image) {
            return {
                isVideo: false,
                downloadUrl: image,
                thumbnailUrl: image
            };
        }

        throw new Error("NO_MEDIA_FOUND");

    } catch (err) {
        throw new Error("MEDIA_NOT_FOUND");
    }
};

module.exports = { getMediaMetadata };
