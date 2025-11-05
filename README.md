# 📋 Kanban Board Backend

Backend API สำหรับ Kanban Board Application ที่รองรับ Google OAuth authentication

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 หรือสูงกว่า)
- npm หรือ yarn
- Google Cloud Console account (สำหรับ OAuth)

### Installation

1. **Clone repository**

```bash
git clone <repository-url>
cd Kanban-Board-Backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup environment variables**

สร้างไฟล์ `.env` ใน root directory ของโปรเจค:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=955151956497-9otafel35l5k6c67peqitkl5acboq2qg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

# JWT Secret (generate ด้วย: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here

# Database Configuration
DATABASE_URL="file:./prisma/dev.db"

# Server Configuration
PORT=5174
CORS_ORIGIN=http://localhost:5173
```

**⚠️ สำคัญ:**

- `GOOGLE_REDIRECT_URI` ต้องตรงกับที่ตั้งค่าใน Google Cloud Console **เป๊ะ**
- ไม่มี trailing slash `/`
- ใช้ `http` ไม่ใช่ `https` สำหรับ localhost

4. **Setup Database**

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

5. **Run development server**

```bash
npm run dev
```

Server จะรันที่ `http://localhost:5174`

## 🔧 Google OAuth Setup (สำหรับ Mac)

### ปัญหาที่พบ

เมื่อ clone โปรเจคไปเปิดใน Mac แล้ว Google OAuth login ไม่ทำงาน เนื่องจาก:

- Environment variables ไม่ได้ถูกตั้งค่า
- Redirect URI อาจไม่ตรงกัน
- Port หรือ hostname อาจต่างกัน

### ✅ วิธีแก้ไข

#### 1. สร้างไฟล์ `.env`

สร้างไฟล์ `.env` ใน root directory และตั้งค่าตามตัวอย่างด้านบน

#### 2. ตั้งค่า Google Cloud Console

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. เลือกโปรเจค
3. ไปที่ **APIs & Services** > **Credentials**
4. เลือก OAuth 2.0 Client ID

**Authorized JavaScript origins:**

```
http://localhost:5173
http://127.0.0.1:5173
```

**Authorized redirect URIs:**

```
http://localhost:5173/auth/google/callback
http://127.0.0.1:5173/auth/google/callback
```

#### 3. ตรวจสอบ Environment Variables

เมื่อรัน server จะเห็น log แสดงสถานะ:

```
[Backend] Google OAuth Config: {
  CLIENT_ID: '✓ Set',
  CLIENT_SECRET: '✓ Set',
  REDIRECT_URI: 'http://localhost:5173/auth/google/callback',
  JWT_SECRET: '✓ Set'
}
[Backend] GOOGLE_REDIRECT_URI: http://localhost:5173/auth/google/callback
[Backend] API listening on http://localhost:5174
```

หากเห็น `✗ Missing` แสดงว่า environment variable นั้นยังไม่ได้ตั้งค่า

## 📡 API Endpoints

### Authentication

#### `POST /api/auth/register`

สร้างบัญชีใหม่

**Request:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "id": "user_id",
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### `POST /api/auth/login`

Login ด้วย email/password

**Request:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### `POST /api/auth/google/initiate`

เริ่ม Google OAuth flow

**Request:**

```json
{}
```

**Response:**

```json
{
  "authUrl": "https://accounts.google.com/oauth/authorize?..."
}
```

#### `POST /api/auth/google/callback`

รับ authorization code จาก Google

**Request:**

```json
{
  "code": "authorization_code_from_google"
}
```

**Response:**

```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": "profile_picture_url",
    "provider": "google"
  }
}
```

### Boards

#### `GET /api/boards`

Get all boards (requires authentication)

#### `POST /api/boards`

Create new board (requires authentication)

#### `GET /api/boards/:id`

Get board by ID (requires authentication)

#### `PUT /api/boards/:id`

Update board (requires authentication)

#### `DELETE /api/boards/:id`

Delete board (requires authentication)

### Notifications

#### `GET /api/notifications`

Get all notifications (requires authentication)

#### `PUT /api/notifications/:id/read`

Mark notification as read (requires authentication)

## 🔍 Troubleshooting

### Error: "redirect_uri_mismatch"

**สาเหตุ:** Redirect URI ใน Google Cloud Console ไม่ตรงกับที่ backend ส่งมา

**แก้ไข:**

1. ตรวจสอบ `GOOGLE_REDIRECT_URI` ในไฟล์ `.env`
2. ตรวจสอบ redirect URIs ใน Google Cloud Console
3. ตรวจสอบว่า redirect_uri ใน authUrl ที่สร้างตรงกับที่ตั้งค่า

### Error: "invalid_client"

**สาเหตุ:** Client ID หรือ Client Secret ไม่ถูกต้อง

**แก้ไข:**

1. ตรวจสอบ `GOOGLE_CLIENT_ID` และ `GOOGLE_CLIENT_SECRET` ในไฟล์ `.env`
2. ตรวจสอบว่า values ตรงกับ Google Cloud Console

### Error: "invalid_grant"

**สาเหตุ:** Authorization code หมดอายุหรือถูกใช้แล้ว

**แก้ไข:**

1. ลอง login ใหม่
2. ตรวจสอบว่า code ถูกส่งไป backend อย่างถูกต้อง

### Environment Variables ไม่ถูกโหลด

**แก้ไข:**

1. ตรวจสอบว่าไฟล์ `.env` อยู่ใน root directory (ที่เดียวกับ `package.json`)
2. ตรวจสอบว่าไม่มี syntax error ในไฟล์ `.env`
3. ตรวจสอบว่าใช้ `dotenv` package (มีอยู่ใน dependencies แล้ว)

## 🛠️ Development

### Available Scripts

```bash
# Run development server (with hot reload)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

### Project Structure

```
Kanban-Board-Backend/
├── src/
│   ├── index.ts          # Main server file
│   ├── lib/
│   │   └── prisma.ts     # Prisma client
│   └── routes/
│       ├── auth.ts       # Authentication routes
│       ├── boards.ts     # Board routes
│       └── notifications.ts # Notification routes
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
├── .env                  # Environment variables (create this)
├── package.json
└── tsconfig.json
```

## 📝 Notes

- ไฟล์ `.env` ไม่ควร commit ไปที่ git repository (ควรอยู่ใน `.gitignore`)
- สำหรับ production ควรใช้ environment variables จาก hosting platform
- JWT token มีอายุ 24 ชั่วโมง
- Database ใช้ SQLite สำหรับ development

## 🔐 Security

- ใช้ bcrypt สำหรับ hash password
- JWT tokens สำหรับ authentication
- CORS ถูกตั้งค่าให้รองรับเฉพาะ origin ที่กำหนด
- Environment variables ใช้สำหรับเก็บ sensitive data

## 📞 Support

หากมีปัญหาหรือคำถามเพิ่มเติม:

1. ตรวจสอบ [ENV_SETUP.md](./ENV_SETUP.md) สำหรับรายละเอียดการตั้งค่า environment variables
2. ตรวจสอบ console logs เมื่อรัน server
3. ตรวจสอบ error messages ที่ backend ส่งกลับมา

## 📄 License

Private project
