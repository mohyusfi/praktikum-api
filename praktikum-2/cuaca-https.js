const https = require("https");
const url =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=-0.8917&longitude=119.8707" +
  "&current=temperature_2m,relative_humidity_2m,wind_speed_10m" +
  "&timezone=Asia/Makassar";

https.get(url, (res) => {
    console.log("Status code :", res.statusCode);
    console.log("Content-Type:", res.headers["content-type"]);
    let body = "";
    let jumlahChunk = 0;

    res.on("data", (chunk) => {
      jumlahChunk++;
      body += chunk;
    });

    res.on("end", () => {
      console.log("Jumlah chunk :", jumlahChunk);
      console.log("Panjang body :", body.length, "karakter");
      console.log(body);
    });
  })
  .on("error", (err) => {
    console.error("Gagal terhubung:", err.message);
  });

console.log("Request dikirim, menunggu jawaban...");
