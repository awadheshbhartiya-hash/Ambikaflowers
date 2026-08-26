/* Ambika Flowers — static site server for Railway */
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Homepage -> index2.html (the shop homepage)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index2.html"));
});

// Serve every file in this folder (html, css, js, images, products/…)
app.use(express.static(__dirname, { extensions: ["html"] }));

// Fallback: anything unknown goes to the homepage
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index2.html"));
});

app.listen(PORT, () => {
  console.log("🌸 Ambika Flowers live on port " + PORT);
});
