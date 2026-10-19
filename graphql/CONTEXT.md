# Domain Model: Rekayasa API — GraphQL & RESTful API

Dokumen ini mendefinisikan model domain dan glosarium kanonik untuk Praktikum 4 Rekayasa Antarmuka Pemrograman Aplikasi (Mata Kuliah Rekayasa API, S1 Teknik Informatika, Universitas Tadulako).

## Entities & Value Objects

### 1. Destination (Destinasi Wisata)
Entitas utama yang merepresentasikan objek tujuan wisata di Sulawesi Tengah.
- **id** (`ID!`): Pengenal unik berbasis integer positif (auto-increment).
- **name** (`String!`): Nama destinasi wisata (contoh: `"Danau Poso"`, `"Pantai Talise"`).
- **category** (`String`): Kategori klasifikasi destinasi (contoh: `"danau"`, `"pantai"`, `"alam"`, `"bahari"`).
- **regionId** (`Int` / `ID!`): Kunci asing (*foreign key*) yang merujuk pada entitas `Region` tempat destinasi berada.
- **region** (`Region`): Relasi GraphQL bertingkat (*nested resolver*) yang mengembalikan objek lengkap daerah destinasi terkait.

### 2. Region (Daerah / Wilayah)
Entitas induk geografis administratif tingkat kabupaten/kota di Sulawesi Tengah.
- **id** (`ID!`): Pengenal unik region (1: Palu, 2: Poso, 3: Donggala, 4: Tojo Una-Una, 5: Sigi).
- **name** (`String!`): Nama kabupaten/kota.
- **latitude** (`Float!`): Koordinat lintang geografis.
- **longitude** (`Float!`): Koordinat bujur geografis.
- **destinations** (`[Destination]`): Relasi terbalik (*inverse relation*) yang menyajikan daftar seluruh destinasi wisata di dalam wilayah tersebut.
- **weather** (`Weather`): Relasi dinamis ke API publik Open-Meteo untuk data meteorologi terkini di lokasi region.

### 3. Weather (Kondisi Cuaca Terkini)
Objek nilai (*value object*) yang diperoleh secara dinamis (*on-demand*) dari API publik Open-Meteo berdasarkan koordinat `latitude` dan `longitude` milik `Region`.
- **temperature** (`Float`): Suhu udara terkini dalam derajat Celsius (`temperature_2m`).
- **windSpeed** (`Float`): Kecepatan angin terkini dalam km/jam (`wind_speed_10m`).
- **humidity** (`Float` / `Int`): Kelembaban relatif udara terkini dalam persen (`relative_humidity_2m`).
- **time** (`String`): Waktu pencatatan observasi cuaca dalam zona waktu setempat (`Asia/Makassar`).

---

## Architectural & Network Concepts

### 4. Over-fetching
Kondisi pada arsitektur API (terutama REST standar) di mana server mengirimkan atribut data yang berlebihan melampaui kebutuhan aktual klien, sehingga membuang lebar pita (*bandwidth*) dan memori.

### 5. Under-fetching (N+1 Network Problem)
Kondisi di mana sebuah titik akses (*endpoint*) API tidak memberikan data yang memadai untuk merender suatu tampilan antarmuka, sehingga klien terpaksa mengeksekusi panggilan jaringan tambahan secara berulang (1 panggilan induk + N panggilan anak).

### 6. Schema & Type System (GraphQL)
Kontrak deklaratif bertipe ketat (*strictly typed*) menggunakan Schema Definition Language (SDL) yang menetapkan tipe entitas, query, dan mutation yang diizinkan oleh server.

### 7. Resolver
Fungsi pelaksana di sisi server yang bertugas memetakan, mengambil, atau menghitung nilai untuk setiap *field* yang diminta dalam kueri GraphQL.

### 8. Mutation
Operasi GraphQL yang menyebabkan perubahan keadaan (*state alteration* / *side effects*) pada data server, seperti penambahan (*create*), pengubahan (*update*), atau penghapusan (*delete*).
