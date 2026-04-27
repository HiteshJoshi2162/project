const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Robust Instagram Media Extractor
 * Designed to handle public reels and posts using multiple extraction strategies.
 */

const getMediaMetadata = async (targetUrl) => {
    console.log(`[EXTRACT] Starting extraction for: ${targetUrl}`);

    // Clean URL to ensure it points to the main content
    let cleanUrl = targetUrl.split('?')[0];
    if (!cleanUrl.endsWith('/')) cleanUrl += '/';

    const maxRetries = 2;
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
        try {
            attempt++;
            console.log(`[EXTRACT] Attempt ${attempt} of ${maxRetries}`);

            const response = await axios.get(cleanUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.instagram.com/',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 12000,
                maxRedirects: 5
            });

            console.log(`[EXTRACT] HTTP Status: ${response.status}`);
            const html = response.data;
            console.log(`[EXTRACT] HTML Preview (first 500 chars): ${html.substring(0, 500).replace(/\s+/g, ' ')}`);

            if (html.includes('login') && html.includes('password')) {
                console.warn('[EXTRACT] Redirected to login page. Instagram is blocking the request or content is private.');
                throw new Error('IG_BLOCKED_OR_PRIVATE');
            }

            const $ = cheerio.load(html);
            let result = null;

            // Strategy 1: Open Graph Meta Tags (High success rate for direct links)
            console.log('[EXTRACT] Trying Strategy 1: OpenGraph Tags');
            const ogVideo = $('meta[property="og:video"]').attr('content');
            const ogImage = $('meta[property="og:image"]').attr('content');
            const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Instagram Media';
            const ogType = $('meta[property="og:type"]').attr('content');

            if (ogVideo) {
                console.log('[EXTRACT] Found video via OG tags');
                result = {
                    type: 'video',
                    downloadUrl: ogVideo,
                    thumbnailUrl: ogImage,
                    caption: ogTitle,
                    isVideo: true
                };
            } else if (ogImage && ogType === 'video') {
                // Sometimes og:video is missing but og:type says video
                console.log('[EXTRACT] OG type is video but og:video is missing, falling back to Strategy 2');
            } else if (ogImage) {
                console.log('[EXTRACT] Found image via OG tags');
                result = {
                    type: 'image',
                    downloadUrl: ogImage,
                    thumbnailUrl: ogImage,
                    caption: ogTitle,
                    isVideo: false
                };
            }

            // Strategy 2: Extract from JSON in Script Tags (__additionalDataLoaded)
            if (!result) {
                console.log('[EXTRACT] Trying Strategy 2: Script Data Parsing');
                const scriptTags = $('script');
                scriptTags.each((i, el) => {
                    const content = $(el).html();
                    if (content && content.includes('video_url')) {
                        const videoMatch = content.match(/"video_url":"([^"]+)"/);
                        const imageMatch = content.match(/"display_url":"([^"]+)"/);
                        const captionMatch = content.match(/"accessibility_caption":"([^"]+)"/);

                        if (videoMatch) {
                            console.log('[EXTRACT] Found video via script regex');
                            result = {
                                type: 'video',
                                downloadUrl: videoMatch[1].replace(/\\u0026/g, '&'),
                                thumbnailUrl: imageMatch ? imageMatch[1].replace(/\\u0026/g, '&') : null,
                                caption: captionMatch ? captionMatch[1] : ogTitle,
                                isVideo: true
                            };
                            return false; // break loop
                        }
                    }
                });
            }

            // Strategy 3: Embed Fallback (Very reliable for basic metadata)
            if (!result) {
                console.log('[EXTRACT] Trying Strategy 3: Embed Data Fallback');
                const embedUrl = `${cleanUrl}embed/captioned/`;
                const embedResponse = await axios.get(embedUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 8000
                });
                const embedHtml = embedResponse.data;
                const $embed = cheerio.load(embedHtml);

                // Note: Embed usually only gives thumbnails and captions, rarely direct video URLs anymore
                // But it can confirm content is public.
                if (embedHtml.includes('Watch on Instagram')) {
                    console.log('[EXTRACT] Embed confirms content is public but may require authenticated session for video URL.');
                }
            }

            if (result) {
                console.log('[EXTRACT] Success: Media extracted');
                return result;
            }

            console.warn('[EXTRACT] All strategies failed for this attempt.');
            if (attempt === maxRetries) throw new Error('MEDIA_NOT_FOUND');

        } catch (error) {
            lastError = error;
            console.error(`[EXTRACT] Error on attempt ${attempt}: ${error.message}`);

            if (error.message === 'IG_BLOCKED_OR_PRIVATE') {
                 // No point in retrying if we hit the login wall immediately
                break;
            }

            // Wait a bit before retry
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    // Final failure handling
    if (lastError.message === 'IG_BLOCKED_OR_PRIVATE') {
        throw new Error('Instagram is blocking this request. The account might be private or the server IP is rate-limited.');
    }

    throw new Error(lastError.message || 'Failed to extract media from the provided URL.');
};

module.exports = { getMediaMetadata };
