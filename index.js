const express = require("express");
const axios = require("axios");
const { URL } = require("url");

const app = express();
const PORT = process.env.PORT || 3333;

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});

app.get("/fetch", async (req, res) => {
  const masterUrl = req.query.url;

  try {
    const masterResponse = await axios.get(masterUrl);
    const masterManifestContent = masterResponse.data;
    const masterOrigin = new URL(masterUrl).origin;

    // Extract URLs of manifest files from the master manifest
    const regex = /#EXT-X-STREAM-INF:.*\n(.+)\n/g;
    const videoUrls = [];
    let match;

    while ((match = regex.exec(masterManifestContent))) {
      let manifestUrl = match[1];

      if (!manifestUrl.startsWith("http")) {
        manifestUrl = new URL(manifestUrl, new URL(masterUrl)).href;
      }

      videoUrls.push(manifestUrl);
    }

    // Extract URLs of manifest files from the master manifest
    const regexA = /#EXT-X-MEDIA:TYPE=AUDIO.*?URI="(.+?)"/g;
    const audioUrls = [];

    while ((match = regexA.exec(masterManifestContent))) {
      let audioUrl = match[1];

      if (!audioUrl.startsWith("http")) {
        audioUrl = new URL(audioUrl, new URL(masterUrl)).href;
      }

      audioUrls.push(audioUrl);
    }

    // Extract URLs of subtitle manifests from the master manifest
    const subtitleUrls = [];
    const subtitleRegex = /#EXT-X-MEDIA:TYPE=SUBTITLES.*?URI="(.+?)"/g;

    while ((match = subtitleRegex.exec(masterManifestContent))) {
      let subtitleUrl = match[1];

      if (!subtitleUrl.startsWith("http")) {
        subtitleUrl = new URL(subtitleUrl, new URL(masterUrl)).href;
        console.log(535, subtitleUrl);
        subtitleUrls.push(subtitleUrl);
      }
    }
    // Combine all manifest URLs (master, media, audio, subtitle)
    const manifestUrls = [masterUrl, ...videoUrls, ...audioUrls, ...subtitleUrls];

    // Fetch each manifest file individually
    const fetchPromises = manifestUrls.map(async (manifestUrl) => {
      try {
        const httpsUrlPattern = /^https:\/\/[^\s/$.?#].[^\s]*$/i;
        let video_uri;
        if (httpsUrlPattern.test(manifestUrl)) {
          video_uri = manifestUrl;
        } else {
          video_uri = new URL(manifestUrl, new URL(masterUrl)).href;
        }
        console.log("[Fetching URL]:", video_uri, manifestUrl, masterUrl);
        const manifestResponse = await axios.get(video_uri);
        const manifestContent = manifestResponse.data;

        // Determine the manifest type based on the URL
        let manifestType;
        if (manifestUrl === masterUrl) {
          manifestType = "Master Manifest";
        } else if (audioUrls.includes(manifestUrl)) {
          manifestType = "Audio Manifest";
        } else if (subtitleUrls.includes(manifestUrl)) {
          manifestType = "Subtitle Manifest";
        } else {
          manifestType = "Media Manifest";
        }

        // Format the manifest content with new lines and indentation
        const formattedManifestContent = manifestContent.replace(/(#EXT[^:]+:)/g, "\n$1").replace(/\n(\n+)/g, "\n");

        //return formattedManifestContent;
        return { type: manifestType, content: formattedManifestContent };
      } catch (error) {
        console.error("Error fetching manifest:", error);
        process.exit(1);
        return null;
      }
    });

    const manifests = await Promise.all(fetchPromises);

    res.json({ manifests: manifests });
  } catch (error) {
    console.error("Error fetching master manifest:", error);
    res.status(500).json({ error: "Error fetching master manifest" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
