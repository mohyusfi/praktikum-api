const https = require("https");
https
  .get("https://api.github.com/users/octocat", (res) => {
    console.log("Status code :", res.statusCode);
    console.log("Content-Type:", res.headers["content-type"]);
    let body = "";
    res.on("data", (chunk) => {
      body += chunk;
    });
    res.on("end", () => console.log(body));
  })
  .on("error", (err) => {
    console.error("Gagal terhubung:", err.message);
  });
