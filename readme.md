# Simple HLS Manifest Viewer

Hello👋


This is a basic web service which given an hls stream url will collect all playlist m3u8 files referenced inside the Multivariant manifest and display them.
It is a helpful service for those times when you may want debug and to know what the contents of the stream is on every variant.

## Environment Variables
`PORT` - Port for the service

## Getting started

To run locally, just run `npm start`. Then go to `http://localhost:<PORT>` and paste a hls stream url and voila! View the playlist manifests


