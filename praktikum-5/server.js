const http = require('http');
const fs = require('fs/promises');
const path = require('path');
// [DITAMBAHKAN DARI C.4 - Langkah 1 (Kode 5.12): Memanggil module crypto]
const crypto = require('crypto');
const { buildSchema, graphql } = require('graphql');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'destinations.json');
const REGION_FILE = path.join(__dirname, 'data', 'regions.json');
// [DITAMBAHKAN DARI C.2 - Langkah 2 (Kode 5.4): Konstanta lokasi file api-keys.json]
const KEY_FILE = path.join(__dirname, 'data', 'api-keys.json');
// [DITAMBAHKAN DARI C.4 - Langkah 2 (Kode 5.13): Konstanta untuk login dan token]
const USER_FILE = path.join(__dirname, 'data', 'users.json');
const TOKEN_SECRET = 'rahasia-praktikum-rekayasa-api-untad-2026-aman';
const MASA_TOKEN = 3600;

// ---------- helper respons ----------
function kirimJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function kirimError(res, statusCode, pesan) {
  kirimJSON(res, statusCode, { error: pesan });
}

// ---------- helper data ----------
async function bacaData() {
  const isi = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(isi);
}

async function simpanData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

async function bacaRegions() {
  const isi = await fs.readFile(REGION_FILE, 'utf8');
  return JSON.parse(isi);
}

// ---------- helper request ----------
function buatError(statusCode, pesan) {
  const err = new Error(pesan);
  err.statusCode = statusCode;
  return err;
}

function bacaBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (body === '') return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(buatError(400, 'Body request bukan JSON yang valid'));
      }
    });
    req.on('error', reject);
  });
}

// ---------- keamanan ----------
// [DITAMBAHKAN DARI C.2 - Langkah 3 (Kode 5.5): Fungsi pemeriksa API key]
async function periksaApiKey(req) {
  const kunci = req.headers['x-api-key'];
  if (!kunci) {
    throw buatError(401, 'API key tidak disertakan. Kirim melalui header x-api-key');
  }

  const isi = await fs.readFile(KEY_FILE, 'utf8');
  const pemilik = JSON.parse(isi).find((k) => k.key === kunci);
  if (!pemilik) {
    throw buatError(401, 'API key tidak dikenal');
  }
  return pemilik;
}

// [DITAMBAHKAN DARI C.4 - Langkah 3 (Kode 5.14): 5 fungsi pemeriksa password dan pembuat token]
function samaAman(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function passwordCocok(password, user) {
  const hash = crypto.scryptSync(password, user.salt, 32).toString('hex');
  return samaAman(hash, user.passwordHash);
}

function keBase64Url(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function tandaTangan(teks) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(teks).digest('base64url');
}

function buatToken(user) {
  const header = keBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = keBase64Url({
    sub: String(user.id),
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + MASA_TOKEN
  });
  const ttd = tandaTangan(`${header}.${payload}`);
  return `${header}.${payload}.${ttd}`;
}

// [DITAMBAHKAN DARI C.5 - Langkah 1 (Kode 5.21): 3 fungsi pemeriksa token (bacaToken, bacaPengguna, wajibLogin)]
function bacaToken(token) {
  const bagian = token.split('.');
  if (bagian.length !== 3) {
    throw buatError(401, 'Format token tidak valid');
  }

  const [header, payload, ttd] = bagian;
  if (!samaAman(ttd, tandaTangan(`${header}.${payload}`))) {
    throw buatError(401, 'Tanda tangan token tidak cocok');
  }

  const isi = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (isi.exp < Math.floor(Date.now() / 1000)) {
    throw buatError(401, 'Token sudah kedaluwarsa, silakan login kembali');
  }
  return isi;
}

function bacaPengguna(req) {
  const nilai = req.headers['authorization'];
  if (!nilai || !nilai.startsWith('Bearer ')) {
    return null;
  }
  return bacaToken(nilai.slice(7));
}

function wajibLogin(pengguna) {
  if (!pengguna) {
    throw buatError(401, 'Anda belum login. Kirim token melalui header Authorization');
  }
  return pengguna;
}

// ---------- logika destinasi ----------
async function periksaDestinasi(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw buatError(400, 'Data destinasi harus berupa object');
  }

  const kurang = ['name', 'category'].filter(
    (field) => typeof input[field] !== 'string' || input[field].trim() === ''
  );
  if (kurang.length > 0) {
    throw buatError(400, `Field wajib belum diisi: ${kurang.join(', ')}`);
  }

  const regionId = Number(input.regionId);
  const regions = await bacaRegions();
  if (!regions.some((r) => r.id === regionId)) {
    throw buatError(400, 'regionId wajib diisi dengan id region yang tersedia');
  }

  return {
    name: input.name.trim(),
    category: input.category.trim(),
    regionId: regionId
  };
}

async function buatDestinasi(input) {
  const bersih = await periksaDestinasi(input);
  const data = await bacaData();
  const idBaru = data.length === 0 ? 1 : Math.max(...data.map((d) => d.id)) + 1;
  const item = { id: idBaru, ...bersih };
  data.push(item);
  await simpanData(data);
  return item;
}

// ---------- handler ----------
async function daftarDestinasi(req, res, url) {
  let data = await bacaData();
  const kategori = url.searchParams.get('category');
  if (kategori) {
    data = data.filter((item) => item.category === kategori);
  }
  kirimJSON(res, 200, data);
}

async function detailDestinasi(req, res, id) {
  const data = await bacaData();
  const item = data.find((d) => d.id === id);
  if (!item) {
    return kirimError(res, 404, `Destinasi dengan id ${id} tidak ditemukan`);
  }
  kirimJSON(res, 200, item);
}

async function tambahDestinasi(req, res) {
  const input = await bacaBody(req);
  const item = await buatDestinasi(input);
  res.setHeader('Location', `/destinations/${item.id}`);
  kirimJSON(res, 201, item);
}

async function ubahDestinasi(req, res, id) {
  const input = await bacaBody(req);
  const data = await bacaData();
  const index = data.findIndex((d) => d.id === id);
  if (index === -1) {
    return kirimError(res, 404, `Destinasi dengan id ${id} tidak ditemukan`);
  }

  const bersih = await periksaDestinasi(input);
  data[index] = { id: id, ...bersih };
  await simpanData(data);
  kirimJSON(res, 200, data[index]);
}

async function hapusDestinasi(req, res, id) {
  const data = await bacaData();
  const index = data.findIndex((d) => d.id === id);
  if (index === -1) {
    return kirimError(res, 404, `Destinasi dengan id ${id} tidak ditemukan`);
  }

  data.splice(index, 1);
  await simpanData(data);
  res.writeHead(204);
  res.end();
}

async function tanganiRegions(req, res, segmen) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return kirimError(res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
  }

  const regions = await bacaRegions();
  if (segmen.length === 1) {
    return kirimJSON(res, 200, regions);
  }

  const item = regions.find((r) => r.id === Number(segmen[1]));
  if (!item) {
    return kirimError(res, 404, `Region dengan id ${segmen[1]} tidak ditemukan`);
  }
  kirimJSON(res, 200, item);
}

// [DITAMBAHKAN DARI C.4 - Langkah 4 (Kode 5.15): Handler untuk endpoint /login]
async function tanganiLogin(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return kirimError(res, 405, 'Endpoint /login hanya menerima method POST');
  }

  const input = await bacaBody(req);
  const lengkap = input !== null
    && typeof input.username === 'string'
    && typeof input.password === 'string';
  if (!lengkap) {
    return kirimError(res, 400, 'Body harus memuat username dan password');
  }

  const isi = await fs.readFile(USER_FILE, 'utf8');
  const user = JSON.parse(isi).find((u) => u.username === input.username);
  if (!user || !passwordCocok(input.password, user)) {
    return kirimError(res, 401, 'Username atau password salah');
  }

  kirimJSON(res, 200, {
    token: buatToken(user),
    tokenType: 'Bearer',
    expiresIn: MASA_TOKEN
  });
}

// ---------- graphql: schema ----------
const schema = buildSchema(`
  type Destination {
    id: ID!
    name: String!
    category: String
  }

  type Query {
    destinations: [Destination]
    destination(id: ID!): Destination
  }
`);

// ---------- graphql: resolver ----------
const resolver = {};

resolver.destinations = async () => {
  const data = await bacaData();
  return data;
};

resolver.destination = async (args) => {
  const data = await bacaData();
  const item = data.find((d) => d.id === Number(args.id));
  if (!item) {
    throw new Error(`Destinasi dengan id ${args.id} tidak ditemukan`);
  }
  return item;
};

// ---------- graphql: handler ----------
async function tanganiGraphQL(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return kirimError(res, 405, 'Endpoint /graphql hanya menerima method POST');
  }

  const body = await bacaBody(req);
  if (body === null || typeof body.query !== 'string') {
    return kirimError(res, 400, 'Body harus berupa JSON yang memiliki field query');
  }

  const hasil = await graphql({
    schema: schema,
    source: body.query,
    rootValue: resolver
  });
  kirimJSON(res, 200, hasil);
}

// ---------- router ----------
// [DIUBAH PADA C.2, C.4, DAN C.5 - Seluruh fungsi router diperbarui terakhir pada C.5 Langkah 2 (Kode 5.22)]
async function router(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const segmen = url.pathname.split('/').filter(Boolean);

  // [DITAMBAHKAN DARI C.2 - Langkah 4 (Kode 5.6): Pemeriksaan API key untuk seluruh request]
  const aplikasi = await periksaApiKey(req);
  console.log(`  aplikasi: ${aplikasi.client}`);

  // [DITAMBAHKAN DARI C.4 - Langkah 5 (Kode 5.16): Mendaftarkan alamat /login pada router]
  if (segmen[0] === 'login' && segmen.length === 1) {
    return tanganiLogin(req, res);
  }

  if (segmen[0] === 'graphql' && segmen.length === 1) {
    return tanganiGraphQL(req, res);
  }

  if (segmen[0] === 'regions' && segmen.length <= 2) {
    return tanganiRegions(req, res, segmen);
  }

  if (segmen[0] !== 'destinations' || segmen.length > 2) {
    return kirimError(res, 404, 'Endpoint tidak ditemukan');
  }

  // Endpoint koleksi: /destinations
  if (segmen.length === 1) {
    if (req.method === 'GET') return daftarDestinasi(req, res, url);
    // [DITAMBAHKAN DARI C.5 - Langkah 2 (Kode 5.22): Pemeriksaan wajibLogin pada POST /destinations]
    if (req.method === 'POST') {
      wajibLogin(bacaPengguna(req));
      return tambahDestinasi(req, res);
    }
    res.setHeader('Allow', 'GET, POST');
    return kirimError(res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
  }

  // Endpoint item: /destinations/:id
  const id = Number(segmen[1]);
  if (!Number.isInteger(id) || id < 1) {
    return kirimError(res, 400, 'id harus berupa bilangan bulat positif');
  }

  if (req.method === 'GET') return detailDestinasi(req, res, id);
  // [DITAMBAHKAN DARI C.5 - Langkah 2 (Kode 5.22): Pemeriksaan wajibLogin pada PUT /destinations/:id]
  if (req.method === 'PUT') {
    wajibLogin(bacaPengguna(req));
    return ubahDestinasi(req, res, id);
  }
  // [DITAMBAHKAN DARI C.5 - Langkah 2 (Kode 5.22): Pemeriksaan wajibLogin pada DELETE /destinations/:id]
  if (req.method === 'DELETE') {
    wajibLogin(bacaPengguna(req));
    return hapusDestinasi(req, res, id);
  }
  res.setHeader('Allow', 'GET, PUT, DELETE');
  return kirimError(res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  try {
    await router(req, res);
  } catch (err) {
    if (err.statusCode) {
      return kirimError(res, err.statusCode, err.message);
    }
    console.error(err);
    kirimError(res, 500, 'Terjadi kesalahan pada server');
  }
});

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});