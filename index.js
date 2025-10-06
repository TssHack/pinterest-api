import axios from "axios";
import * as cheerio from "cheerio";
import express from "express";

const app = express();

app.get("/", async (req, res) => {
  res.json({
    status: 403,
    developer: "t.me/Devehsan",
    message: "not set parameter url!"
  });
});

app.get("/", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    // درخواست HTML صفحه
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
    });

    const $ = cheerio.load(response.data);

    // پیدا کردن تگ‌های JSON پنهان
    let jsonData = null;
    $('script[data-relay-response="true"][type="application/json"]').each(
      (i, el) => {
        const text = $(el).text().trim();
        const data = JSON.parse(text);
        if (
          data?.requestParameters?.name === "CloseupDetailQuery"
        ) {
          jsonData = data;
        }
      }
    );

    if (!jsonData)
      return res.status(404).json({ error: "Pin not found" });

    const parsed = parsePin(jsonData);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function parsePin(data) {
  const pin = data?.response?.data?.v3GetPinQuery?.data;
  if (!pin) return { error: "Invalid data structure" };

  const mediaType = detectMediaType(pin);

  return {
    pin_id: pin.entityId || null,
    title: pin.title || pin.gridTitle || "",
    description: (pin.description || "").trim(),
    seo_title: pin.seoTitle || "",
    created_at: pin.createdAt || "",
    dominant_color: pin.dominantColor || null,
    media_type: mediaType,
    best_url: getBestMediaUrl(pin, mediaType),
    original_pinner: formatPinner(pin.originPinner),
    current_pinner: formatPinner(pin.pinner),
    board: {
      name: pin.board?.name || "",
      url: pin.board?.url || "",
      pin_count: pin.board?.pinCount || null,
    },
    stats: {
      saves: pin.aggregatedPinData?.aggregatedStats?.saves || null,
      repins: pin.repinCount || null,
      shares: pin.shareCount || null,
      comments: pin.aggregatedPinData?.commentCount || null,
    },
    tags: pin.pinJoin?.visualAnnotation || [],
    seo_breadcrumbs: pin.pinJoin?.seoBreadcrumbs || [],
    all_images: getAllImages(pin),
    video_info: getVideoInfo(pin),
    extra: {
      is_promoted: pin.isPromoted || false,
      domain: pin.domain || "",
      category: pin.category || "",
    },
  };
}

function detectMediaType(pin) {
  if (pin.storyPinData?.pages?.[0]?.blocks?.[0]?.videoDataV2) return "video";
  if (pin.embed?.type === "gif") return "gif";
  if (pin.embed?.src?.endsWith(".gif")) return "gif";
  return "image";
}

function getBestMediaUrl(pin, type) {
  if (type === "video") return getBestVideo(pin);
  if (type === "gif")
    return pin.embed?.src || pin.imageSpec_orig?.url || null;
  return (
    pin.imageSpec_orig?.url ||
    pin.images?.url ||
    pin.imageLargeUrl ||
    null
  );
}

function getBestVideo(pin) {
  const video =
    pin.storyPinData?.pages?.[0]?.blocks?.[0]?.videoDataV2 || null;
  if (!video) return null;
  return (
    video.videoList720P?.v720P?.url ||
    video.videoListMobile?.vHLSV3MOBILE?.url ||
    null
  );
}

function formatPinner(pinner) {
  if (!pinner) return null;
  return {
    id: pinner.entityId || null,
    username: pinner.username || "",
    name: pinner.fullName || "",
    profile: {
      small: pinner.imageSmallUrl || "",
      medium: pinner.imageMediumUrl || "",
      large: pinner.imageLargeUrl || "",
    },
    followers: pinner.followerCount || null,
    verified: pinner.isVerifiedMerchant || false,
  };
}

function getAllImages(pin) {
  const sizes = [
    "orig",
    "736x",
    "564x",
    "474x",
    "236x",
    "136x136",
    "60x60",
    "170x",
    "600x315",
  ];
  const images = {};
  for (const size of sizes) {
    const key = `imageSpec_${size}`;
    if (pin[key]?.url) images[size] = pin[key].url;
  }
  if (pin.images?.url) images.images = pin.images.url;
  if (pin.imageLargeUrl) images.large = pin.imageLargeUrl;
  return images;
}

function getVideoInfo(pin) {
  const video =
    pin.storyPinData?.pages?.[0]?.blocks?.[0]?.videoDataV2 || null;
  if (!video) return null;

  const info = {
    duration: null,
    width: null,
    height: null,
    thumbnail: null,
    qualities: {},
  };

  const qualities = {
    videoList720P: "720p",
    videoListMobile: "mobile",
    videoListEXP3: "exp3",
    videoListEXP4: "exp4",
    videoListEXP5: "exp5",
    videoListEXP6: "exp6",
    videoListEXP7: "exp7",
  };

  for (const [list, label] of Object.entries(qualities)) {
    if (!video[list]) continue;
    const q = Object.values(video[list])[0];
    if (!q) continue;

    info.qualities[label] = {
      url: q.url || null,
      width: q.width || null,
      height: q.height || null,
      duration: q.duration || null,
      thumbnail: q.thumbnail || null,
    };

    if (!info.duration && q.duration) {
      info.duration = q.duration;
      info.width = q.width;
      info.height = q.height;
      info.thumbnail = q.thumbnail;
    }
  }

  return info;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
