const express = require("express");
const axios = require("axios");
const client = require("./client");
const app = express();

app.get("/", async (req, res) => {
  const { data } = await axios.get("https://jsonplaceholder.typicode.com/users");

  const cacheValue = await client.get("users");

  if (cacheValue) {
    // Parse cached JSON string before returning
    return res.json(JSON.parse(cacheValue));
  }

  // Store new data in Redis
  await client.set("users", JSON.stringify(data));

  // Set expiration (example: 60 seconds)
  await client.expire("users", 60);

  return res.json(data);
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
