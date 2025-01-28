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

    // Extract URLs and bandwidths of manifest files from the master manifest
    const regex = /#EXT-X-STREAM-INF:(.+)\n(.+)/g;
    const videoUrls = [];
    const bandwidths = [];
    let match;

    while ((match = regex.exec(masterManifestContent))) {
      const attributes = match[1];
      let manifestUrl = match[2];
      
      // Extract bandwidth from attributes
      const bandwidthMatch = attributes.match(/BANDWIDTH=(\d+)/);
      const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : null;

      if (!manifestUrl.startsWith("http")) {
        manifestUrl = new URL(manifestUrl, new URL(masterUrl)).href;
      }

      videoUrls.push(manifestUrl);
      bandwidths.push(bandwidth);
    }

    // Extract URLs of manifest files from the master manifest
    const regexA = /#EXT-X-MEDIA:TYPE=AUDIO.*?URI="(.+?)"/g;
    const audioUrls = [];
    const audioInfo = [];  // Add this to store audio metadata

    while ((match = regexA.exec(masterManifestContent))) {
      let audioUrl = match[1];
      // Extract GROUP-ID and LANGUAGE from the full match
      const groupMatch = match[0].match(/GROUP-ID="([^"]+)"/);
      const langMatch = match[0].match(/LANGUAGE="([^"]+)"/);
      const nameMatch = match[0].match(/NAME="([^"]+)"/);
      const groupId = groupMatch ? groupMatch[1] : 'unknown';
      const language = langMatch ? langMatch[1] : nameMatch ? nameMatch[1] : 'unknown';

      if (!audioUrl.startsWith("http")) {
        audioUrl = new URL(audioUrl, new URL(masterUrl)).href;
      }

      audioUrls.push(audioUrl);
      audioInfo.push({ url: audioUrl, groupId, language });
    }

    // Extract URLs of subtitle manifests from the master manifest
    const subtitleUrls = [];
    const subtitleInfo = [];  // Add this to store subtitle metadata
    const subtitleRegex = /#EXT-X-MEDIA:TYPE=SUBTITLES.*?URI="(.+?)"/g;

    while ((match = subtitleRegex.exec(masterManifestContent))) {
      let subtitleUrl = match[1];
      // Extract GROUP-ID and LANGUAGE from the full match
      const groupMatch = match[0].match(/GROUP-ID="([^"]+)"/);
      const langMatch = match[0].match(/LANGUAGE="([^"]+)"/);
      const nameMatch = match[0].match(/NAME="([^"]+)"/);
      const groupId = groupMatch ? groupMatch[1] : 'unknown';
      const language = langMatch ? langMatch[1] : nameMatch ? nameMatch[1] : 'unknown';

      if (!subtitleUrl.startsWith("http")) {
        subtitleUrl = new URL(subtitleUrl, new URL(masterUrl)).href;
        subtitleUrls.push(subtitleUrl);
        subtitleInfo.push({ url: subtitleUrl, groupId, language });
      }
    }
    // Combine all manifest URLs (master, media, audio, subtitle)
    const manifestUrls = [masterUrl, ...videoUrls, ...audioUrls, ...subtitleUrls];

    // Fetch each manifest file individually
    const fetchPromises = manifestUrls.map(async (manifestUrl, index) => {
      try {
        const httpsUrlPattern = /^https:\/\/[^\s/$.?#].[^\s]*$/i;
        let video_uri;
        if (httpsUrlPattern.test(manifestUrl)) {
          video_uri = manifestUrl;
        } else {
          video_uri = new URL(manifestUrl, new URL(masterUrl)).href;
        }
        //console.log("[Fetching URL]:", video_uri, manifestUrl, masterUrl);
        const manifestResponse = await axios.get(video_uri);
        const manifestContent = manifestResponse.data;

        // Determine the manifest type and add metadata
        let manifestType;
        let bandwidth = null;
        let metadata = null;

        if (manifestUrl === masterUrl) {
          manifestType = "Master Manifest";
        } else if (audioUrls.includes(manifestUrl)) {
          manifestType = "Audio Manifest";
          const audioMeta = audioInfo.find(info => info.url === manifestUrl);
          if (audioMeta) {
            metadata = {
              groupId: audioMeta.groupId,
              language: audioMeta.language
            };
          }
        } else if (subtitleUrls.includes(manifestUrl)) {
          manifestType = "Subtitle Manifest";
          const subtitleMeta = subtitleInfo.find(info => info.url === manifestUrl);
          if (subtitleMeta) {
            metadata = {
              groupId: subtitleMeta.groupId,
              language: subtitleMeta.language
            };
          }
        } else {
          manifestType = "Media Manifest";
          const mediaIndex = videoUrls.indexOf(manifestUrl);
          if (mediaIndex !== -1) {
            bandwidth = bandwidths[mediaIndex];
          }
        }

        // Format the manifest content with new lines and indentation
        const formattedManifestContent = manifestContent.replace(/(#EXT[^:]+:)/g, "\n$1").replace(/\n(\n+)/g, "\n");

        //return formattedManifestContent;
        return { 
          type: manifestType, 
          content: formattedManifestContent,
          bandwidth: bandwidth,
          metadata: metadata
        };
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
